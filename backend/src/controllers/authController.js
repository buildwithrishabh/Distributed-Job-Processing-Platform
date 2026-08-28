const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const env = require("../config/env");

const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} = require("../utils/jwt");

// ================= GET ME =================
exports.getMe = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};

// ================= REGISTER =================
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check fields
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Please fill all fields",
      });
    }

    // Check existing user
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ================= LOGIN =================
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check user (explicitly select password field as it has select: false in schema)
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const hashingtoken = hashToken(refreshToken);

    // Save refresh token
    user.refreshToken = hashingtoken;
    await user.save();

    const isProduction = process.env.NODE_ENV === "production";

    // Set cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 15 * 60 * 1000,
    });

    res.status(200).json({
      message: "Login successful",
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        message: "Refresh token missing",
      });
    }

    // Verify refresh token using env fallback
    const refreshSecret =
      process.env.JWT_REFRESH_SECRET ||
      env.REFRESH_TOKEN_SECRET ||
      env.JWT_SECRET;
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, refreshSecret);
    } catch (jwtErr) {
      return res.status(401).json({
        message:
          jwtErr.name === "TokenExpiredError"
            ? "Refresh token expired"
            : "Invalid refresh token",
      });
    }

    // Find user (explicitly select refreshToken field as it has select: false in schema)
    const user = await User.findById(decoded.id).select("+refreshToken");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // check token in db
    const hashedToken = hashToken(refreshToken);

    if (user.refreshToken !== hashedToken) {
      return res.status(403).json({
        message: "Refresh token mismatch",
      });
    }
    // Generate new access token
    const newaccessToken = generateAccessToken(user);
    const newrefreshToken = generateRefreshToken(user);

    const hashingTokenRefresh = hashToken(newrefreshToken);

    user.refreshToken = hashingTokenRefresh;
    await user.save();

    const isProduction = process.env.NODE_ENV === "production";
    // Set cookie
    res.cookie("refreshToken", newrefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie("accessToken", newaccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 15 * 60 * 1000,
    });

    res.status(200).json({
      message: "Refresh token successful",
      accessToken: newaccessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ================= LOGOUT =================
exports.logout = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      return res.status(204).json({
        message: "No refresh token found",
      });
    }

    // Hash the token so we can find it in the DB
    const hashedToken = hashToken(token);

    const user = await User.findOne({
      refreshToken: hashedToken,
    });

    if (user) {
      user.refreshToken = null;
      await user.save();
    }

    const isProduction = process.env.NODE_ENV === "production";
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    }); // Also clear access token if you are using it in cookies!

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};
