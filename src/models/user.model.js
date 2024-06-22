import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true, // when any field is more used for searching
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    avatar: {
      type: String, // cloudinary url
      required: true,
    },
    coverImage: {
      type: String, // cloudinary url
    },
    watchHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "Video",
      },
    ],
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    refreshToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// pre hook - hooks are middleware functions
// on saving data of a user hash the password
userSchema.pre("save", async function(next) {
    // if password is not modified/changed then do not hash the password
    // ex. user has changed avatar
    if(!this.isModified("password")) return next();

    // hash the password
    this.password = bcrypt.hash(this.password, 10);
    next() ;
});

// we can create any custom method using "methods"
// custom method for checking password - used before importing "User" in any module
// checking whether password is correct
userSchema.methods.isPasswordCorrect = async function(password){
    // compare the password with hashed password
    return await bcrypt.compare(password, this.password);
}

// method to generate access token
userSchema.methods.generateAccessToken = function() {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
      fullName: this.fullName
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY
    }
  )
}

// method to generate referesh token
userSchema.methods.generateRefereshToken = function() {
  return jwt.sign(
    {
      _id: this._id
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY
    }
  )
}

export const User = mongoose.model("User", userSchema);
