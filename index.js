const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");

const app = express();
const PORT = 3000;
const DB_PATH = "./db.json";
const INIT_DB_PATH = "./init_db.json";

// Middleware
app.use(bodyParser.json());

// Load the initial state of the database
let db = require(DB_PATH);
const initialDbState = require(INIT_DB_PATH);

// Helper function to save to the fake database
function saveDb() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// GET route to fetch all available movies
app.get("/movies", (req, res) => {
  res.json(db.movies);
});

// POST route to select specific seats and return a payment code, status as UNPAID
app.post("/select-seat", (req, res) => {
  const { movieId, time, seats } = req.body;

  const movie = db.movies.find((m) => m.id === movieId);
  if (!movie) return res.status(404).json({ error: "Movie not found" });

  const showtime = movie.times.find((t) => t.time === time);
  if (!showtime)
    return res.status(404).json({ error: "Showtime not available" });

  const unavailableSeats = seats.filter(
    (seat) => !showtime.availableSeats.includes(seat)
  );
  if (unavailableSeats.length > 0) {
    return res
      .status(400)
      .json({ error: "Some seats are not available", unavailableSeats });
  }

  const paymentCode = `PAY-${Math.floor(100000 + Math.random() * 900000)}`;
  const totalPrice = showtime.price * seats.length;

  // Record the booking with status UNPAID
  db.bookings.push({
    paymentCode,
    movieId,
    time,
    seats,
    totalPrice,
    status: "UNPAID",
  });

  saveDb();

  res.json({ paymentCode, status: "UNPAID", totalPrice });
});

app.get("/payment-status", (req, res) => {
  const { paymentCode } = req.query;

  const booking = db.bookings.find((b) => b.paymentCode === paymentCode);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }

  res.json({
    paymentCode: booking.paymentCode,
    status: booking.status,
    seats: booking.seats,
    totalPrice: booking.totalPrice,
    movieId: booking.movieId,
    time: booking.time,
  });
});

app.post("/reset-db", (req,res)=>{
    const { password } = req.body;
    if (password === "reset") {
      resetDb();
      res.status(200).json({ message: "Database reset successfully" });
    } else {
      res.status(401).json({ error: "Unauthorized" });
    }
})

// POST route to pay with payment code and mark booking as PAID
app.post("/paying", (req, res) => {
  const { paymentCode } = req.body;

  const booking = db.bookings.find((b) => b.paymentCode === paymentCode);
  if (!booking) return res.status(404).json({ error: "Invalid payment code" });

  if (booking.status === "PAID") {
    return res.status(400).json({ error: "This booking is already paid" });
  }

  booking.status = "PAID";

  // Update seat availability now that payment is confirmed
  const movie = db.movies.find((m) => m.id === booking.movieId);
  const showtime = movie.times.find((t) => t.time === booking.time);

  booking.seats.forEach((seat) => {
    showtime.availableSeats = showtime.availableSeats.filter((s) => s !== seat);
  });

  saveDb();

  res.json({ message: "Payment successful", booking });
});

// Function to reset the database every 2 hours
function resetDb() {
  db = JSON.parse(JSON.stringify(initialDbState));
  saveDb();
  console.log("Database reset to initial state.");
}

// Schedule the resetDb function to run every 2 hours
setInterval(resetDb, 2 * 60 * 60 * 1000);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
