const express = require("express");
const path = require("path");
const port = process.env.PORT || 3000;
const app = express();
const passport = require("passport");
const session = require("express-session");
const bodyParser = require("body-parser");
const GitHubStrategy = require("passport-github").Strategy;
const indexController = require("./components/index/index.controller");
const cookieParser = require("cookie-parser");

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(
  new GitHubStrategy(
    {
      clientID: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/github/callback"
    },
    function(accessToken, refreshToken, profile, done) {
      process.nextTick(function() {
        return done(
          null,
          Object.assign({}, profile, { ghAccessToken: accessToken })
        );
      });
    }
  )
);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/components"));
app.use(
  session({ secret: "keyboard cat", resave: false, saveUninitialized: false })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(cookieParser());
app.use("/public", express.static(process.cwd() + "/public"));

app.get(
  "/auth/github",
  passport.authenticate("github", {
    scope:
      "user public_repo repo repo_deployment repo:status read:repo_hook read:org read:public_key read:gpg_key"
  })
);

app.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/login" }),
  function(req, res) {
    res.cookie("ghAccessToken", req.user.ghAccessToken);
    res.redirect("/");
  }
);

app.get("/", ensureAuthenticated, indexController);

app.get("/login", function(req, res) {
  res.render("login/login");
});

app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

app.listen(port, function() {
  console.log(`Server listening on port ${port}…`);
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/auth/github");
}
