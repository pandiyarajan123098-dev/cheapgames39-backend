require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

/* =====================================================
   ================= MIDDLEWARE ========================
===================================================== */

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);

// 🔥 VERY IMPORTANT (You forgot this)
app.use(express.json());

/* =====================================================
   ================= SUPABASE CLIENT ===================
===================================================== */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* =====================================================
   ================= AUTH MIDDLEWARE ===================
===================================================== */

const verifyUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ error: "Authentication failed" });
  }
};

/* =====================================================
   ================= HEALTH CHECK ======================
===================================================== */

app.get("/", (req, res) => {
  res.status(200).json({ message: "Backend Running 🚀" });
});

/* =====================================================
   ===================== GAMES =========================
===================================================== */

app.get("/api/games", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("games")
      .select(`*, categories(name)`);

    if (error) throw error;

    res.status(200).json(data);
  } catch (err) {
    console.error("Fetch games error:", err.message);
    res.status(500).json({ error: "Failed to fetch games" });
  }
});

app.get("/api/games/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("games")
      .select(`*, categories(name)`)
      .eq("id", req.params.id)
      .single();

    if (error) {
      return res.status(404).json({ error: "Game not found" });
    }

    res.status(200).json(data);
  } catch (err) {
    console.error("Fetch game error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

/* =====================================================
   ===================== CATEGORIES ====================
===================================================== */

app.get("/api/categories", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*");

    if (error) throw error;

    res.status(200).json(data);
  } catch (err) {
    console.error("Category fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

/* =====================================================
   ===================== WISHLIST ======================
===================================================== */

app.get("/api/wishlist", verifyUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("wishlist")
      .select(`id, game_id, games(*)`)
      .eq("user_id", req.user.id);

    if (error) throw error;

    res.status(200).json(data);
  } catch (err) {
    console.error("Wishlist fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch wishlist" });
  }
});

app.post("/api/wishlist/:gameId", verifyUser, async (req, res) => {
  try {
    const { gameId } = req.params;

    const { error } = await supabase
      .from("wishlist")
      .insert([{ user_id: req.user.id, game_id: gameId }]);

    if (error) throw error;

    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Wishlist insert error:", err.message);
    res.status(500).json({ error: "Failed to add to wishlist" });
  }
});

app.delete("/api/wishlist/:gameId", verifyUser, async (req, res) => {
  try {
    const { gameId } = req.params;

    const { error } = await supabase
      .from("wishlist")
      .delete()
      .eq("user_id", req.user.id)
      .eq("game_id", gameId);

    if (error) throw error;

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Wishlist delete error:", err.message);
    res.status(500).json({ error: "Failed to remove from wishlist" });
  }
});

/* =====================================================
   ===================== REVIEWS =======================
===================================================== */

app.get("/api/reviews/:gameId", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select(`*, users(full_name)`)
      .eq("game_id", req.params.gameId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.status(200).json(data);
  } catch (err) {
    console.error("Review fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

app.post("/api/reviews", verifyUser, async (req, res) => {
  try {
    const { game_id, rating, comment } = req.body;

    if (!game_id || !rating) {
      return res.status(400).json({ error: "Invalid review data" });
    }

    const { error } = await supabase.from("reviews").insert([
      {
        user_id: req.user.id,
        game_id,
        rating,
        comment,
      },
    ]);

    if (error) throw error;

    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Review insert error:", err.message);
    res.status(500).json({ error: "Failed to submit review" });
  }
});

/* =====================================================
   ===================== ORDERS ========================
===================================================== */

app.post("/api/orders", verifyUser, async (req, res) => {
  try {
    const {
      billing_name,
      billing_email,
      billing_address,
      billing_city,
      billing_zip,
      total_price,
    } = req.body;

    if (!billing_name || !billing_email || !total_price) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { data, error } = await supabase
      .from("orders")
      .insert([
        {
          user_id: req.user.id,
          billing_name,
          billing_email,
          billing_address,
          billing_city,
          billing_zip,
          total_price,
          status: "pending",
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    console.error("Order create error:", err.message);
    res.status(500).json({ error: "Failed to create order" });
  }
});

app.put("/api/orders/:id", verifyUser, async (req, res) => {
  try {
    const { transaction_id } = req.body;

    const { data, error } = await supabase
      .from("orders")
      .update({
        transaction_id,
        status: "paid",
      })
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json(data);
  } catch (err) {
    console.error("Order update error:", err.message);
    res.status(500).json({ error: "Failed to update order" });
  }
});

/* =====================================================
   ================= CONTACT ===========================
===================================================== */

app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: "All fields required" });
    }

    const { error } = await supabase
      .from("contact_message")
      .insert([{ name, email, message }]);

    if (error) throw error;

    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Contact error:", err.message);
    res.status(500).json({ error: "Failed to send message" });
  }
});

/* =====================================================
   ================= SERVER START ======================
===================================================== */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});