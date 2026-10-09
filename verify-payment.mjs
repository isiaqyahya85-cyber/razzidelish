const esc = (value = "") => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = kobo => "₦" + (Number(kobo || 0) / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 });
function page({ ok, heading, detail, reference, amount, orderDetails }) {
  const waText = encodeURIComponent(`Hello Paparazzi Delish!\n${orderDetails || ""}\nPayment reference: ${reference || "Not available"}\nPayment status: ${ok ? "Verified by Paystack" : "Not verified"}`);
  const button = ok ? `<a class="button" href="https://wa.me/2348114616110?text=${waText}">Send order details on WhatsApp ↗</a>` : `<a class="button" href="/">Return to website and try again</a>`;
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${ok ? "Payment received" : "Payment not confirmed"} | Paparazzi Delish</title><style>body{margin:0;background:#fff8ef;color:#211712;font:16px system-ui,sans-serif;display:grid;min-height:100vh;place-items:center}.card{max-width:560px;margin:20px;background:white;border:1px solid #eadfd3;border-radius:24px;padding:30px;box-shadow:0 18px 45px #28160c12}h1{font-size:2rem;line-height:1.1}.status{font-weight:900;color:${ok ? "#137b49" : "#9f2d22"}}.button{display:inline-block;background:#137b49;color:white;text-decoration:none;padding:14px 18px;border-radius:12px;font-weight:800;margin-top:15px}.ref{overflow-wrap:anywhere;background:#fff8ef;padding:10px;border-radius:8px}pre{white-space:pre-wrap;line-height:1.5}</style><main class="card"><p>🍗 PAPARAZZI DELISH</p><p class="status">${ok ? "✓ PAYMENT VERIFIED" : "! PAYMENT NOT CONFIRMED"}</p><h1>${esc(heading)}</h1><p>${esc(detail)}</p>${ok ? `<p><b>Verified amount:</b> ${esc(money(amount))}</p>` : ""}<p><b>Payment reference</b></p><div class="ref">${esc(reference || "Not available")}</div>${ok && orderDetails ? `<h3>Order summary</h3><pre>${esc(orderDetails)}</pre>` : ""}${button}<p style="color:#786b61;font-size:.85rem;margin-top:22px">${ok ? "Paystack confirmed this transaction. Keep this reference for your records." : "Do not prepare the order based on this page. Check your Paystack dashboard or retry payment."}</p></main></html>`, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
export default async (request) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const reference = new URL(request.url).searchParams.get("reference");
  if (!secret || !secret.startsWith("sk_test_")) return page({ ok:false, heading:"Test payment setup is incomplete", detail:"The site owner still needs to configure the Paystack TEST secret key in Netlify." , reference });
  if (!reference || reference.length > 100) return page({ ok:false, heading:"We couldn't verify this payment", detail:"No valid payment reference was provided.", reference });
  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}`, "Cache-Control": "no-cache" } });
    const result = await response.json();
    const d = result?.data;
    const expected = Number(d?.metadata?.expected_amount_kobo);
    const ok = response.ok && result.status === true && d?.status === "success" && d?.currency === "NGN" && Number.isFinite(expected) && Number(d.amount) === expected;
    return page({ ok, heading: ok ? "Your payment has been received" : "Payment is not confirmed yet", detail: ok ? "Paystack successfully verified this test transaction. Remember, this is test mode and no real money was collected." : "Paystack did not confirm a successful transaction for the expected amount. You have not been marked as paid.", reference, amount: d?.amount, orderDetails: ok ? d?.metadata?.order_details : "" });
  } catch { return page({ ok:false, heading:"We couldn't verify this payment", detail:"A connection error occurred. Please return to the site and try again.", reference }); }
};
