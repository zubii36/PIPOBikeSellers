require("dotenv").config();
const express = require("express");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const multer = require("multer");
const db = require("./database/database");
const uploadFolder = path.join(__dirname, "uploads");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadFolder);
  },

  filename: function (req, file, cb) {
    const extension =
      path.extname(file.originalname).toLowerCase();

    const safeOrderId =
      String(req.body.orderId || "unknown")
        .replace(/[^a-zA-Z0-9-_]/g, "");

    cb(
      null,
      `${safeOrderId}-${Date.now()}${extension}`
    );
  }
});


const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024
  },

  fileFilter: function (req, file, cb) {

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf"
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only JPG, PNG, WEBP images or PDF files are allowed."
        )
      );
    }
  }
});
if (!require("fs").existsSync(uploadFolder)) {
  require("fs").mkdirSync(uploadFolder, {
    recursive: true
  });
}
async function sendTelegramMessage(message) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  await axios.post(url, {
    chat_id: process.env.TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: "HTML"
  });
}
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/tractors", (req, res) => {
  res.json(tractors);
});

app.get("/api/tractors/:id", (req, res) => {
  const tractor = tractors.find(t => t.id === req.params.id);
  if (!tractor) return res.status(404).json({ error: "Tractor not found" });
  res.json(tractor);
});
app.post("/api/orders", async (req, res) => {
  const {
    tractorId,
    fullName,
    email,
    phone,
    address,
    city,
    state,
    paymentMethod
  } = req.body;

  const tractor = tractors.find(
    t => t.id === tractorId
  );

  if (!tractor) {
    return res.status(400).json({
      error: "Invalid tractor selected."
    });
  }

  if (
    !fullName ||
    !email ||
    !phone ||
    !address ||
    !city ||
    !state||
    !paymentMethod
  ) {
    return res.status(400).json({
      error: "Please complete all customer details."
    });
  }

  // Clean phone number
  const cleanPhone = String(phone).replace(/\D/g, "");

  // US number must contain exactly 10 digits
  if (!/^\d{10}$/.test(cleanPhone)) {
    return res.status(400).json({
      error: "Please enter exactly 10 digits for the US phone number."
    });
  }

  const formattedPhone = `+1${cleanPhone}`;

  const orderId =
    `TRC-${Date.now().toString().slice(-8)}`;

  const depositAmount =
    tractor.priceUSD *
    (tractor.depositPercent / 100);

  try {

    const insertOrder = db.prepare(`
      INSERT INTO orders (
        order_id,
        tractor_id,
        tractor_name,
        tractor_price_usd,
        deposit_percent,
        deposit_amount_usd,
        full_name,
        email,
        phone,
        address,
        city,
        country,
        state,
        payment_method
      )
      VALUES (
        @orderId,
        @tractorId,
        @tractorName,
        @tractorPrice,
        @depositPercent,
        @depositAmount,
        @fullName,
        @email,
        @phone,
        @address,
        @city,
        @country,
        @state,
        @paymentMethod
      )
    `);

    insertOrder.run({
      orderId,
      tractorId: tractor.id,
      tractorName: tractor.name,
      tractorPrice: tractor.priceUSD,
      depositPercent: tractor.depositPercent,
      depositAmount,

      fullName,
      email,
      phone: formattedPhone,
      address,
      city,

      // Old database column.
      // The customer does NOT see this field.
      country: "United States",

      // New field used by the platform.
      state,
      paymentMethod
    });


    // Send Telegram notification
    const telegramMessage =` 
🚜 <b>NEW TRACTOR ORDER</b>

<b>Order Number:</b> ${orderId}

<b>Tractor:</b> ${tractor.name}
<b>Tractor Price:</b> $${tractor.priceUSD.toLocaleString()}
<b>Deposit:</b> $${depositAmount.toLocaleString()}

<b>Customer Details</b>
<b>Name:</b> ${fullName}
<b>Email:</b> ${email}
<b>Phone:</b> ${formattedPhone}
<b>Address:</b> ${address}
<b>City:</b> ${city}
<b>State:</b> ${state}
<b>Preferred Payment Method:</b> ${paymentMethod}
<b>Payment Status:</b> Pending
`;

    try {

      await sendTelegramMessage(telegramMessage);

      console.log(
        "Telegram notification sent."
      );

    } catch (telegramError) {

      console.error(
        "Telegram notification error:",
        telegramError.response?.data ||
        telegramError.message
      );

    }


    res.status(201).json({
      message: "Order successfully saved.",
      orderId,
      tractor: tractor.name,
      depositAmount,
      paymentStatus: "pending"
    });


  } catch (error) {

    console.error(
      "Database error:",
      error
    );

    res.status(500).json({
      error: "Unable to save the order."
    });

  }
});
app.post(
  "/api/orders/payment-screenshot",
  upload.single("paymentScreenshot"),
  async (req, res) => {

    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        error: "Order number is required."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Please upload a payment confirmation."
      });
    }

    try {

      const order = db.prepare(`
        SELECT *
        FROM orders
        WHERE order_id = ?
      `).get(orderId);

      if (!order) {

        return res.status(404).json({
          error: "Order not found."
        });

      }


      db.prepare(`
        UPDATE orders
        SET payment_screenshot = ?
        WHERE order_id = ?
      `).run(
        req.file.filename,
        orderId
      );


     const telegramMessage =` 
📸 <b>PAYMENT CONFIRMATION UPLOADED</b>

<b>Order Number:</b> ${order.order_id}

<b>Customer:</b> ${order.full_name}
<b>Email:</b> ${order.email}
<b>Phone:</b> ${order.phone}

<b>Tractor:</b> ${order.tractor_name}

<b>Payment Method:</b> ${order.payment_method}

<b>Payment Status:</b> Pending Verification
`;

try {
  // Send order information first
  await sendTelegramMessage(telegramMessage);

  // Send the actual uploaded file
  const form = new FormData();

  form.append(
    "chat_id",
    process.env.TELEGRAM_CHAT_ID
  );

  form.append(
    "document",
    require("fs").createReadStream(
      req.file.path
    )
  );

  await axios.post(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendDocument`,
    form,
    {
      headers: form.getHeaders()
    }
  );

  console.log(
    "Payment confirmation file sent to Telegram."
  );

} catch (telegramError) {

  console.error(
    "Telegram notification error:",
    telegramError.response?.data ||
    telegramError.message
  );
}


      res.json({
        message:
          "Payment confirmation uploaded successfully."
      });


    } catch (error) {

      console.error(
        "Payment screenshot error:",
        error
      );

      res.status(500).json({
        error:
          "Unable to save payment confirmation."
      });

    }

  }
);
const tractors = [
  {
    id: "jd-5075e",
    brand: "John Deere",
    model: "5075E",
    name: "John Deere 5075E",
    priceUSD: 65000,
    depositPercent: 6.5,
    horsepower: "75 hp",
    engine: "3-cylinder diesel",
    transmission: "PowerReverser",
    drive: "2WD / 4WD options",
    weight: "Approx. 3,000 kg",
    liftCapacity: "Approx. 1,800 kg",
    description: "Utility tractor designed for general agricultural and farm operations."
  },
  {
    id: "kubota-mx5400",
    brand: "Kubota",
    model: "MX5400",
    name: "Kubota MX5400",
    priceUSD: 45000,
    depositPercent: 6.5,
    horsepower: "55 hp",
    engine: "4-cylinder diesel",
    transmission: "Hydrostatic / mechanical options",
    drive: "2WD / 4WD options",
    weight: "Approx. 2,500 kg",
    liftCapacity: "Approx. 1,500 kg",
    description: "Utility tractor suitable for farming, loaders and general property work."
  },
  {
    id: "case-farmall-50a",
    brand: "Case IH",
    model: "Farmall 50A",
    name: "Case IH Farmall 50A",
    priceUSD: 45000,
    depositPercent: 6.5,
    horsepower: "50 hp",
    engine: "Diesel",
    transmission: "Mechanical",
    drive: "2WD / 4WD options",
    weight: "Approx. 2,300 kg",
    liftCapacity: "Approx. 1,500 kg",
    description: "Compact utility tractor for everyday agricultural applications."
  },
  {
    id: "nh-workmaster-70",
    brand: "New Holland",
    model: "Workmaster 70",
    name: "New Holland Workmaster 70",
    priceUSD: 45000,
    depositPercent: 6.5,
    horsepower: "70 hp",
    engine: "Diesel",
    transmission: "Mechanical",
    drive: "2WD / 4WD options",
    weight: "Approx. 2,800 kg",
    liftCapacity: "Approx. 1,800 kg",
    description: "Utility tractor built for a range of agricultural and property tasks."
  },
  {
    id: "mf-1755m",
    brand: "Massey Ferguson",
    model: "1755M",
    name: "Massey Ferguson 1755M",
    priceUSD: 45000,
    depositPercent: 6.5,
    horsepower: "55 hp",
    engine: "Diesel",
    transmission: "Mechanical",
    drive: "4WD",
    weight: "Approx. 2,500 kg",
    liftCapacity: "Approx. 1,500 kg",
    description: "Compact utility tractor for farms and general agricultural work."
  },
  {
    id: "mahindra-4540",
    brand: "Mahindra",
    model: "4540",
    name: "Mahindra 4540",
    priceUSD: 35000,
    depositPercent: 6.5,
    horsepower: "40 hp",
    engine: "4-cylinder diesel",
    transmission: "Mechanical",
    drive: "2WD / 4WD options",
    weight: "Approx. 2,000 kg",
    liftCapacity: "Approx. 1,500 kg",
    description: "Utility tractor aimed at general farm and agricultural operations."
  },
  {
    id: "fendt-300",
    brand: "Fendt",
    model: "300 Series",
    name: "Fendt 300 Series",
    priceUSD: 90000,
    depositPercent: 6.5,
    horsepower: "Approx. 75–110 hp",
    engine: "Diesel",
    transmission: "Fendt transmission options",
    drive: "4WD",
    weight: "Varies by configuration",
    liftCapacity: "Varies by configuration",
    description: "Modern utility tractor range with configurations for professional agriculture."
  },
  {
    id: "claas-eliost",
    brand: "CLAAS",
    model: "Eliot / compact range",
    name: "CLAAS Compact Tractor Range",
    priceUSD: 70000,
    depositPercent: 6.5,
    horsepower: "Varies",
    engine: "Diesel",
    transmission: "Varies",
    drive: "4WD options",
    weight: "Varies",
    liftCapacity: "Varies",
    description: "Tractor range for agricultural and farm applications."
  },
  {
    id: "deutz-fahr-5080",
    brand: "DEUTZ-FAHR",
    model: "5080 Series",
    name: "DEUTZ-FAHR 5080 Series",
    priceUSD: 75000,
    depositPercent: 6.5,
    horsepower: "Approx. 80 hp",
    engine: "Diesel",
    transmission: "Mechanical / powershift options",
    drive: "4WD",
    weight: "Varies by configuration",
    liftCapacity: "Varies by configuration",
    description: "Utility tractor range for agricultural applications."
  },
  {
    id: "mccormick-x5",
    brand: "McCormick",
    model: "X5",
    name: "McCormick X5",
    priceUSD: 75000,
    depositPercent: 6.5,
    horsepower: "Approx. 95–113 hp",
    engine: "Diesel",
    transmission: "Mechanical / powershift options",
    drive: "4WD",
    weight: "Varies by configuration",
    liftCapacity: "Varies by configuration",
    description: "Utility tractor family for agricultural and farm operations."
  },
  {
    id: "yanmar-ym",
    brand: "Yanmar",
    model: "YM Series",
    name: "Yanmar YM Series",
    priceUSD: 30000,
    depositPercent: 6.5,
    horsepower: "Varies",
    engine: "Diesel",
    transmission: "Mechanical",
    drive: "2WD / 4WD options",
    weight: "Varies by model",
    liftCapacity: "Varies by model",
    description: "Compact tractor range for farming and property applications."
  }
];

app.listen(PORT, () => {
  console.log(`Tractor Order Platform running on port ${PORT}`);
});
