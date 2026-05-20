const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

// Kunci rahsia Toyyibpay dan Category Code (Ganti dengan yang sebenar)
const TOYYIBPAY_SECRET_KEY = "SILA_MASUKKAN_SECRET_KEY_TOYYIBPAY_ANDA";
const TOYYIBPAY_CATEGORY_CODE = "SILA_MASUKKAN_CATEGORY_CODE_ANDA";

exports.createPaymentBill = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  try {
    const { amount, campaignName, donorName, donorEmail, donorPhone } = req.body;
    
    if (!amount) {
      res.status(400).json({ error: "Sila berikan jumlah bayaran." });
      return;
    }

    // Bina payload form-urlencoded untuk Toyyibpay
    const bodyParams = new URLSearchParams();
    bodyParams.append('userSecretKey', TOYYIBPAY_SECRET_KEY);
    bodyParams.append('categoryCode', TOYYIBPAY_CATEGORY_CODE);
    bodyParams.append('billName', campaignName || 'Sumbangan Kempen MyDana');
    bodyParams.append('billDescription', 'Sumbangan untuk ' + (campaignName || 'Kempen MyDana'));
    bodyParams.append('billPriceSetting', 1); // 1 = Fixed Amount
    bodyParams.append('billPayorInfo', 1); // 1 = Required
    bodyParams.append('billAmount', amount); // Jumlah dalam sen
    bodyParams.append('billReturnUrl', 'https://example.com/success'); // Tukar kepada link berjaya anda nanti
    bodyParams.append('billCallbackUrl', 'https://example.com/callback'); // URL untuk callback dari pelayan Toyyibpay
    bodyParams.append('billTo', donorName || 'Penyumbang MyDana');
    bodyParams.append('billEmail', donorEmail || 'admin@mydana.com');
    bodyParams.append('billPhone', donorPhone || '0123456789');
    bodyParams.append('billSplitPayment', 0);
    bodyParams.append('billSplitPaymentArgs', '');
    bodyParams.append('billPaymentChannel', '0'); // 0 = FPX
    bodyParams.append('billDisplayMerchant', 1);

    const response = await fetch('https://toyyibpay.com/index.php/api/createBill', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: bodyParams.toString()
    });

    const data = await response.json();
    
    if (data && data.length > 0 && data[0].BillCode) {
      // Kembalikan URL pembayaran Toyyibpay
      res.json({ url: `https://toyyibpay.com/${data[0].BillCode}` });
    } else {
      throw new Error('Gagal mencipta bil Toyyibpay: ' + JSON.stringify(data));
    }
  } catch (error) {
    logger.error("Ralat Toyyibpay:", error);
    res.status(500).json({ error: error.message });
  }
});


