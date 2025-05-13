const express = require("express");

const mongoose = require("mongoose");

const bcrypt = require("bcryptjs");

const bcryptSalt = bcrypt.genSaltSync(10);

const cors = require("cors");

const app = express();

const User = require("./model/User"); //*model for user



require("dotenv").config();

const CookieParser = require("cookie-parser");

const jwtSecret = process.env.JWT_SECRET;

const api_key = "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"

const jwt = require("jsonwebtoken");

app.use(express.urlencoded({ extended: true }));

app.use(express.json());

const corsOptions = {
  origin: process.env.CLIENT_URL,
  credentials: true,
};

app.use(cors(corsOptions));

app.use(CookieParser());


//~ Connect to MongoDB

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("Connected to MongoDB successfully");
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB:", error);
  });

  //~ ----------end of mongo connect ------------------------



    //* gpt Route //

  app.post('/completions' , async (req,res)=>{
    const options = {
      method:'POST',
      headers:{
        'Authorization': `Bearer ${api_key}`,
        'Content-Type': "application/json"
      },
      body:JSON.stringify({
        model:'gpt-3.5-turbo',
        messages:[{role:'user' , content:req.body.message}],
        max_tokens:100,
      })
    }
          try{
        const response = await fetch('https://api.openai.com/v1/chat/completions', options)
        const data = await response.json()
        res.send(data)
          }
          catch(err){
            console.log(err)
          }
  })




//! --------------------------------------- End point -creation starts -------------------------------

//~ Register a new user
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashPassword = bcrypt.hashSync(password, bcryptSalt);
    const createdUser = await User.create({
      username: username,
      password: hashPassword,
    });

    jwt.sign(
      { userId: createdUser._id, username },
      jwtSecret,
      {},
      (err, token) => {
        if (err) {
          console.error("Failed to create JWT token:", err);
          res.status(500).json("Internal server error");
        } else {
          res.cookie("token", token).status(201).json({
            id: createdUser._id,
          });
        }
      }
    );
  } catch (err) {
    console.error("Failed to register user:", err);
    res.status(500).json("Internal server error");
  }
});

///~login///

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const foundUser = await User.findOne({ username });
  if (foundUser) {
    const passOk = bcrypt.compareSync(password, foundUser.password);
    if (passOk) {
      jwt.sign(
        { userId: foundUser._id, username },
        jwtSecret,
        {},
        (err, token) => {
          if (err) throw err;
          res.cookie("token", token).json({
            id: foundUser._id,
          });
        }
      );
    }
  }
});

//  //~ Logout //

 app.post('/logout', (req , res)=>{
  res.cookie('token' , '' , {sameSite :'none' , secure:true}).json('deleted')
 })


//~ profile///

app.get("/profile", (req, res) => {
  const token = req.cookies?.token;
  if (token) {
    jwt.verify(token, jwtSecret, {}, (err, userData) => {
      if (err) throw err;

      res.json(userData);
    });
  } else {
    res.status(401).json("No token");
  }
});



  

app.listen(4050);

// -----------------------start of ws ---------------------------





