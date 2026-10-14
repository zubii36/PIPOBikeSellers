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

app.get("/api/bikes", (req, res) => {
  res.json(tractors);
});

app.get("/api/bikes/:id", (req, res) => {
  const bike = tractors.find(t => t.id === req.params.id);

  if (!bike) {
    return res.status(404).json({ error: "Bike not found" });
  }

  res.json(bike);
});
app.post("/api/orders", async (req, res) => {
  const {
    bikeId,
    tractorId,
    fullName,
    email,
    phone,
    address,
    city,
    state,
    bikeColor,
    paymentMethod
  } = req.body;

  const selectedId = bikeId || tractorId;

  const tractor = tractors.find(
  t => t.id === selectedId
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
    !bikeColor||
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
    `BIKE-${Date.now().toString().slice(-8)}`;

  const depositAmount =
    tractor.priceUSD *
    (tractor.depositPercent / 100);

  try {

    const insertOrder = db.prepare(`
      INSERT INTO orders (
        order_id,
        tractor_id,
        tractor_name,
        bike_color,
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
        @bikeColor,
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
      bikeColor,
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
🚜 <b>NEW BIKE ORDER</b>

<b>Order Number:</b> ${orderId}

<b>Bike:</b> ${tractor.name}
<b>Preferred Colour:</b> ${bikeColor}
<b>Bike Price:</b> $${tractor.priceUSD.toLocaleString()}
<b>Deposit (6.5%):</b> $${depositAmount.toLocaleString()}
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
// Add bike_color to existing orders tables if it is missing.
const orderColumns = db.prepare(
  "PRAGMA table_info(orders)"
).all();

const hasBikeColor = orderColumns.some(
  column => column.name === "bike_color"
);

if (!hasBikeColor) {
  db.exec(`
    ALTER TABLE orders
    ADD COLUMN bike_color TEXT NOT NULL DEFAULT 'Not specified'
  `);

  console.log("Added bike_color column to orders table.");
}
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
    id: "trek-marlin-7",
    brand: "Trek",
    model: "Marlin 7",
    name: "Trek Marlin 7 Mountain Bike",
    priceUSD: 550,
    depositPercent: 6.5,
    bikeType: "Mountain Bike",
    frame: "Aluminum",
    gears: "Multiple gears",
    brakes: "Hydraulic disc brakes",
    suspension: "Front suspension",
    description: "Versatile mountain bike for trails, outdoor adventures and everyday riding."
  },
  {
    id: "specialized-rockhopper",
    brand: "Specialized",
    model: "Rockhopper",
    name: "Specialized Rockhopper",
    priceUSD: 700,
    depositPercent: 6.5,
    bikeType: "Mountain Bike",
    frame: "Aluminum",
    gears: "Multiple gears",
    brakes: "Disc brakes",
    suspension: "Front suspension",
    description: "Mountain bike designed for recreational trail riding and outdoor exploration."
  },
  {
    id: "giant-talon",
    brand: "Giant",
    model: "Talon",
    name: "Giant Talon Mountain Bike",
    priceUSD: 750,
    depositPercent: 6.5,
    bikeType: "Mountain Bike",
    frame: "Aluminum",
    gears: "Multiple gears",
    brakes: "Disc brakes",
    suspension: "Front suspension",
    description: "Hardtail mountain bike for trails, parks and recreational cycling."
  },
  {
    id: "cannondale-synapse",
    brand: "Cannondale",
    model: "Synapse",
    name: "Cannondale Synapse Road Bike",
    priceUSD: 1800,
    depositPercent: 6.5,
    bikeType: "Road Bike",
    frame: "Aluminum or carbon, depending on model",
    gears: "Multiple gears",
    brakes: "Disc brakes",
    suspension: "Rigid frame",
    description: "Road bike designed for fitness rides, long-distance cycling and paved roads."
  },
  {
    id: "trek-domane",
    brand: "Trek",
    model: "Domane AL",
    name: "Trek Domane AL Road Bike",
    priceUSD: 1200,
    depositPercent: 6.5,
    bikeType: "Road Bike",
    frame: "Aluminum",
    gears: "Multiple gears",
    brakes: "Disc brakes",
    suspension: "Rigid frame",
    description: "Comfort-oriented road bike for commuting, fitness and longer rides."
  },
  {
    id: "schwinn-phocus",
    brand: "Schwinn",
    model: "Phocus",
    name: "Schwinn Phocus Road Bike",
    priceUSD: 600,
    depositPercent: 6.5,
    bikeType: "Road Bike",
    frame: "Aluminum",
    gears: "Multiple gears",
    brakes: "Model-dependent brakes",
    suspension: "Rigid frame",
    description: "Entry-level road bike for fitness riding and everyday paved-road cycling."
  },
  {
    id: "redline-bmx",
    brand: "Redline",
    model: "Proline BMX",
    name: "Redline BMX Bike",
    priceUSD: 550,
    depositPercent: 6.5,
    bikeType: "BMX Bike",
    frame: "Model-dependent alloy or steel",
    gears: "Single speed",
    brakes: "BMX brakes",
    suspension: "Rigid frame",
    description: "BMX-style bicycle for track riding and recreational cycling."
  },
  {
    id: "mongoose-legend",
    brand: "Mongoose",
    model: "Legend",
    name: "Mongoose BMX Bike",
    priceUSD: 550,
    depositPercent: 6.5,
    bikeType: "BMX Bike",
    frame: "Model-dependent steel or alloy",
    gears: "Single speed",
    brakes: "Model-dependent brakes",
    suspension: "Rigid frame",
    description: "BMX-style bike for recreational riding and beginner riders."
  },
  {
    id: "giant-escape",
    brand: "Giant",
    model: "Escape",
    name: "Giant Escape Hybrid Bike",
    priceUSD: 600,
    depositPercent: 6.5,
    bikeType: "Hybrid Bike",
    frame: "Aluminum",
    gears: "Multiple gears",
    brakes: "Model-dependent brakes",
    suspension: "Rigid frame",
    description: "Practical hybrid bicycle for commuting, fitness and paved paths."
  },
  {
    id: "rad-power-radcity",
    brand: "Rad Power Bikes",
    model: "RadCity",
    name: "Rad Power RadCity Electric Bike",
    priceUSD: 1450,
    depositPercent: 6.5,
bikeType: "Electric Bike",
    frame: "Aluminum",
    gears: "Model-dependent gearing",
    brakes: "Model-dependent disc brakes",
    suspension: "Model-dependent suspension",
    description: "Electric-assist bicycle designed for commuting and everyday transportation."
  },
  {
    id: "aventon-level",
    brand: "Aventon",
    model: "Level",
    name: "Aventon Level Electric Bike",
    priceUSD: 1400,
    depositPercent: 6.5,
    bikeType: "Electric Bike",
    frame: "Aluminum",
    gears: "Multiple gears",
    brakes: "Hydraulic disc brakes",
    suspension: "Front suspension",
    description: "Electric commuter bicycle designed for everyday trips and recreational riding."
  },
  {
  id: "trek-precaliber",
  brand: "Trek",
  model: "Precaliber",
  name: "Trek Precaliber Kids Bike",
  priceUSD: 300,
  depositPercent: 6.5,
  bikeType: "Kids' Bike",
  frame: "Lightweight aluminum",
  gears: "Single speed",
  brakes: "Rim brakes",
  suspension: "Rigid",
  description: "A versatile children's bicycle for everyday riding."
},
{
  id: "schwinn-cruiser",
  brand: "Schwinn",
  model: "Cruiser",
  name: "Schwinn Cruiser Bike",
  priceUSD: 300,
  depositPercent: 6.5,
  bikeType: "Cruiser Bike",
  frame: "Steel",
  gears: "Single speed",
  brakes: "Coaster brake",
  suspension: "Rigid",
  description: "A comfortable cruiser bicycle for relaxed rides."
},
{
  id: "brompton-c-line",
  brand: "Brompton",
  model: "C Line",
  name: "Brompton C Line Folding Bike",
  priceUSD: 1500,
  depositPercent: 6.5,
  bikeType: "Folding Bike",
  frame: "Steel",
  gears: "Multiple speeds",
  brakes: "Rim brakes",
  suspension: "Rigid",
  description: "A compact folding bicycle designed for commuting and storage."
},
{
  id: "giant-trance",
  brand: "Giant",
  model: "Trance",
  name: "Giant Trance Full-Suspension Mountain Bike",
  priceUSD: 1500,
  depositPercent: 6.5,
  bikeType: "Mountain Bike",
  frame: "Aluminum",
  gears: "Multiple speeds",
  brakes: "Hydraulic disc brakes",
  suspension: "Front and rear suspension",
  description: "A trail-oriented mountain bike for off-road adventures."
},
{
  id: "specialized-allez",
  brand: "Specialized",
  model: "Allez",
  name: "Specialized Allez Road Bike",
  priceUSD: 1100,
  depositPercent: 6.5,
  bikeType: "Road Bike",
  frame: "Aluminum",
  gears: "Multiple speeds",
  brakes: "Disc brakes",
  suspension: "Rigid",
  description: "A road bicycle designed for paved roads and fitness riding."
},
{
  id: "tern-link",
  brand: "Tern",
  model: "Link Folding Bike",
  name: "Tern Link Folding Bike",
  priceUSD: 900,
  depositPercent: 6.5,
  bikeType: "Folding Bike",
  frame: "Aluminum",
  gears: "Multiple speeds",
  brakes: "V-brakes",
  suspension: "Rigid",
  description: "A practical folding bicycle for city commuting and easy storage."
}

];
app.listen(PORT, () => {
  console.log(`Tractor Order Platform running on port ${PORT}`);
});
