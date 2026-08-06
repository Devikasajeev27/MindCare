const RAZORPAY_CDN = "https://checkout.razorpay.com/v1/checkout.js";

let scriptPromise: Promise<void> | null = null;

export function loadRazorpayScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    if ((window as any).Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_CDN;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Failed to load Razorpay SDK"));
    };
    document.body.appendChild(script);
  });

  return scriptPromise;
}

export async function openRazorpayCheckout(options: Record<string, any>): Promise<void> {
  await loadRazorpayScript();
  const RazorpayConstructor = (window as any).Razorpay;
  if (!RazorpayConstructor) {
    throw new Error("Razorpay SDK not available");
  }

  const checkoutOptions = { ...options };

  // If order_id is a demo order ID, omit order_id from SDK options to prevent Razorpay 400 Bad Request
  if (typeof checkoutOptions.order_id === "string" && checkoutOptions.order_id.startsWith("order_demo_")) {
    const demoOrderId = checkoutOptions.order_id;
    delete checkoutOptions.order_id;

    const originalHandler = checkoutOptions.handler;
    checkoutOptions.handler = (response: any) => {
      if (originalHandler) {
        originalHandler({
          ...response,
          razorpay_order_id: response?.razorpay_order_id || demoOrderId,
          razorpay_signature: response?.razorpay_signature || "demo_signature",
        });
      }
    };
  }

  const rzp = new RazorpayConstructor(checkoutOptions);
  rzp.open();
}
