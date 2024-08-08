const port = 5000;
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables

const app = express();

app.use(express.json());
app.use(cors());

const URI = process.env.MongoDBURI;
const TOKEN=process.env.ACCESSTOKEN;

// Connect to MongoDB
mongoose.connect(URI)
.then(() => console.log("Connected to MongoDB"))
.catch((error) => console.error("Error connecting to MongoDB:", error));


// Create the upload directory if it doesn't exist
const uploadDir = path.join(__dirname, 'upload/images');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup for file storage
const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });

// Serve static files from the 'upload/images' directory
app.use('/images', express.static(uploadDir));

// Route for file upload
app.post("/upload", upload.single('product'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    res.json({
        success: true,
        image_url: `https://e-commerce-web-1-w74e.onrender.com/images/${req.file.filename}`
    });
});

// Root route
app.get("/", (req, res) => {
    res.send("Express App is Running");
});

// Product model
const Product = mongoose.model("Product", {
    id: {
        type: Number,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    new_price: {
        type: Number,
        required: true,
    },
    old_price: {
        type: Number,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    available: {
        type: Boolean,
        default: true,
    }
});

// User model
const User = mongoose.model('User', {
    name: {
        type: String,
    },
    email: {
        type: String,
        unique: true,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    cartData: {
        type: Object,
    },
    date: {
        type: Date,
        default: Date.now,
    }
});

// Salt rounds for bcrypt
const saltRounds = 10;

// Route to register user
app.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if the user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ success: false, error: "Existing user found with the same email address" });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create a new user with a default cart
        let cart = {};
        for (let i = 0; i < 300; i++) {
            cart[i] = 0;
        }

        user = new User({
            name: username,
            email: email,
            password: hashedPassword,
            cartData: cart
        });
        await user.save();

        // Create and send a JWT token
        const token = jwt.sign({ id: user._id },TOKEN, { expiresIn: '1h' });
        res.json({ success: true, token });
    } catch (error) {
        console.error("Error signing up user:", error);
        res.status(500).json({ success: false, message: "Failed to sign up user" });
    }
});

// Route to add product
app.post('/addproduct', async (req, res) => {
    try {
        let products = await Product.find({});
        let id = products.length > 0 ? products[products.length - 1].id + 1 : 1;

        const product = new Product({
            id: id,
            name: req.body.name,
            image: req.body.image,
            category: req.body.category,
            new_price: req.body.new_price,
            old_price: req.body.old_price,
        });

        await product.save();
        res.json({
            success: true,
            name: req.body.name,
        });
    } catch (error) {
        console.error("Error adding product:", error);
        res.status(500).json({ success: false, message: "Failed to add product" });
    }
});

// Route to delete product
app.post('/removeproduct', async (req, res) => {
    try {
        const result = await Product.findOneAndDelete({ id: req.body.id });
        if (!result) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        res.json({
            success: true,
            id: req.body.id
        });
    } catch (error) {
        console.error("Error removing product:", error);
        res.status(500).json({ success: false, message: "Failed to remove product" });
    }
});

// Route to get all products
app.get('/allproducts', async (req, res) => {
    try {
        let products = await Product.find({});
        res.send(products);
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ success: false, message: "Failed to fetch products" });
    }
});

// Route to log in user
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find the user by email
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ success: false, error: "Wrong Email" });
        }

        // Compare the provided password with the hashed password in the database
        const passCompare = await bcrypt.compare(password, user.password);
        if (!passCompare) {
            return res.status(400).json({ success: false, error: "Wrong Password" });
        }

        // Create and send a JWT token
        const token = jwt.sign({ id: user._id }, TOKEN, { expiresIn: '1h' });
        res.json({ success: true, token });
    } catch (error) {
        console.error("Error logging in user:", error);
        res.status(500).json({ success: false, message: "Failed to log in user" });
    }
});

// Route for fetching new collections
app.get('/newcollections', async (req, res) => {
    try {
        let products = await Product.find({});
        let newCollection = products.slice(-8);
        res.send(newCollection);
    } catch (error) {
        console.error("Error fetching new collection:", error);
        res.status(500).json({ success: false, message: "Failed to fetch new collection" });
    }
});

// Endpoint for popular in women
app.get('/popularinwomen', async (req, res) => {
    try {
        let products = await Product.find({ category: "women" });
        let popularInWomen = products.slice(0, 4);
        res.send(popularInWomen);
    } catch (error) {
        console.error("Error fetching popular in women:", error);
        res.status(500).json({ success: false, message: "Failed to fetch popular in women" });
    }
});

// Middleware to fetch user
const fetchUser = async (req, res, next) => {
    const token = req.header('auth-token');
    if (!token) {
        return res.status(401).json({ error: 'Please authenticate with a valid token' });
    }
    try {
        const data = jwt.verify(token, TOKEN);
        req.user = data;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Endpoint for adding data to cart
app.post('/addtocart', fetchUser, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { itemId } = req.body;
        if (!user.cartData[itemId]) {
            user.cartData[itemId] = 0;
        }
        user.cartData[itemId] += 1;

        await user.save();
        res.json({ success: true, cartData: user.cartData });
    } catch (error) {
        console.error("Error adding to cart:", error);
        res.status(500).json({ success: false, message: "Failed to add to cart" });
    }
});

// Endpoint for getting user cart data
app.get('/getcart', fetchUser, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ success: true, cartData: user.cartData });
    } catch (error) {
        console.error("Error fetching cart data:", error);
        res.status(500).json({ success: false, message: "Failed to fetch cart data" });
    }
});
//creating end point to remove data from cart
app.post('/removefromcart', fetchUser, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { itemId } = req.body;
        if (user.cartData[itemId] > 0) {
            user.cartData[itemId] -= 1;
            await user.save();
            res.json({ success: true, cartData: user.cartData });
        } else {
            res.status(400).json({ success: false, message: "Item not in cart or quantity is already zero" });
        }
    } catch (error) {
        console.error("Error removing from cart:", error);
        res.status(500).json({ success: false, message: "Failed to remove from cart" });
    }
});

app.post('/getcart', fetchUser, async (req, res) => {
    console.log("GetCart");
    let userData = await User.findOne({ _id: req.user.id });
    res.json(userData.cartData);
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
