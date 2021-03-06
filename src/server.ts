/**
 * Module dependencies.
 */
import "reflect-metadata";
import * as express             from "express";
import * as compression         from "compression";  // compresses requests
import * as session             from "express-session";
import * as bodyParser          from "body-parser";
import * as logger              from "morgan";
import * as errorHandler        from "errorhandler";
import * as lusca               from "lusca";
import * as dotenv              from "dotenv";
import * as flash               from "express-flash";
import * as path                from "path";
import * as passport            from "passport";
import * as https               from "https";
import * as models              from "./models";
import chalk                    from "chalk";
import { createConnection,
                   Connection } from "typeorm";
const expressValidator          = require("express-validator");
const fs                        = require("fs");
const config                    = require("./config/env").getConfig();
import { getAcceptedLocale }    from "./middlewares";

/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
dotenv.config({ path: ".env.example" });

/**
 * API keys and Passport configuration.
 */
import * as passportConfig    from "./config/passport";

// create connection with database
// note that it's not active database connection
// TypeORM creates connection pools and uses them for your requests
createConnection().then(async (connection: Connection) => {

  /**
   * Create Express server.
   */

  const app: express.Application = express();

  /**
   * Express configuration.
   */

  app.set("port", process.env.PORT || 443);
  app.set("models", models);
  app.use(compression());
  app.use(logger("dev"));
  app.use(bodyParser.json({ limit: "50mb" }));
  app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
  app.use(bodyParser.json());
  app.use(expressValidator());
  app.use(session({
    resave: true,
    saveUninitialized: true,
    secret: process.env.SESSION_SECRET
  }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(flash());
  app.use(lusca.xframe("SAMEORIGIN"));
  app.use(lusca.xssProtection(true));
  app.use((req, res, next) => {
    res.locals.user = req.user;
    next();
  });
  app.use(getAcceptedLocale);
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", config.client.baseURL);
    res.header("Access-Control-Allow-Headers", "accept-language, authorization, content-type");
    res.header("Access-Control-Allow-Methods", "GET, PATCH, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Credentials", "true");

    next();
  });
  app.use(express.static(path.join(__dirname, "public"), { maxAge: 31557600000 }));

  /**
   * Routes (route handlers).
   */

  require("./routes")(app);

  /**
   * Error Handler. Provides full stack - remove for production
   */
  app.use(errorHandler());

  const httpsOptions = {
    key: fs.readFileSync(path.join(process.cwd(), "certificate", "key.pem"), "utf8"),
    cert: fs.readFileSync(path.join(process.cwd(), "certificate", "cert.pem"), "utf8")
  };

  const httpsServer = https.createServer(httpsOptions, app).listen(443, () => {
    console.log(("  App is running at https://localhost:%d in %s mode"), app.get("port"), app.get("env"));
    console.log("  Press CTRL-C to stop\n");
  });

}).catch(error => console.log("TypeORM connection error: ", error));
