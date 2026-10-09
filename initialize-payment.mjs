const PRODUCTS = {
  1: { name: "Jollof Rice", price: 2500 },
  2: { name: "Fried Rice", price: 3000 },
  3: { name: "Jollof Rice + Chicken", price: 5000 },
  4: { name: "Fried Rice + Chicken", price: 5000 },
  5: { name: "Extra Chicken", price: 2000 },
};
const DELIVERY_FEE = 500;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !secret.startsWith("sk_test_")) return json({ error: "Paystack TEST secret key is not configured in Netlify yet." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request data." }, 400); }
  const c = body?.customer || {};
  if (!c.name || !c.phone || !c.email || !c.address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) return json({ error: "Please enter your name, phone, valid email, and delivery address." }, 400);
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 10) return json({ error: "Your cart is empty or invalid." }, 400);
  let subtotal = 0; const lines = [];
  for (const entry of body.items) {
    const id = Number(entry.id), qty = Number(entry.quantity), product = PRODUCTS[id];
    if (!product || !Number.isInteger(qty) || qty < 1 || qty > 20) return json({ error: "One of the cart items or quantities is invalid." }, 400);
    subtotal += product.price * qty;
    lines.push(`${product.name} x${qty} — ₦${(product.price * qty).toLocaleString("en-NG")}`);
  }
  const totalNaira = subtotal + DELIVERY_FEE;
  const baseUrl = process.env.URL || "https://razzidelish.netlify.app";
  const orderDetails = ["PAPARAZZI DELISH ORDER", ...lines, `Food subtotal: ₦${subtotal.toLocaleString("en-NG")}`, `Delivery estimate: ₦${DELIVERY_FEE.toLocaleString("en-NG")}`, `Total paid: ₦${totalNaira.toLocaleString("en-NG")}`, `Customer: ${String(c.name).slice(0,100)}`, `Phone: ${String(c.phone).slice(0,40)}`, `Address: ${String(c.address).slice(0,200)}`, `Spice: ${String(c.spice || "Medium").slice(0,40)}`, `Notes: ${String(c.notes || "None").slice(0,300)}`].join("\n");
  try {
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", "Cache-Control": "no-cache" },
      body: JSON.stringify({ email: c.email, amount: String(totalNaira * 100), currency: "NGN", callback_url: `${baseUrl}/.netlify/functions/verify-payment`, metadata: { expected_amount_kobo: totalNaira * 100, order_details: orderDetails, customer_name: String(c.name).slice(0,100), customer_phone: String(c.phone).slice(0,40) } })
    });
    const data = await paystackResponse.json();
    if (!paystackResponse.ok || !data.status || !data.data?.authorization_url) return json({ error: "Paystack could not start checkout. Check the test account and try again." }, 502);
    return json({ authorization_url: data.data.authorization_url, reference: data.data.reference });
  } catch { return json({ error: "Could not connect to Paystack. Please try again." }, 502); }
};
