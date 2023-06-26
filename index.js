import express, { query } from "express";
import mysql from "mysql";
import cors from "cors";
import jwt, { verify } from "jsonwebtoken";
import bcrypt from "bcrypt";

const app = express();
const db = mysql.createConnection({
  host: "localhost",
  user: "mysql",
  password: "AleXKlanS1)",
  database: "myfirstdb",
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get("/", (req, res) => {
  res.json("hello, this is the backend");
});

const verifyJWT = (req, res, next) => {
  const token = req.headers["x-access-token"];
  if (!token) {
    res.send("I need a token.");
  } else {
    jwt.verify(token, "jwtSecret", (err, decoded) => {
      if (err) {
        res.send(`${err}`);
      } else {
        req.userId = decoded.id;
        next();
      }
    });
  }
};

app.get("/posts", verifyJWT, (req, res) => {
  const queryAllPostsSelect = "SELECT * FROM post";
  queryRun(queryAllPostsSelect, res);
});

app.get("/post/:id", (req, res) => {
  const queryOnePostSelect = `SELECT * FROM post WHERE id = ${req.params.id}`;
  queryRun(queryOnePostSelect, res);
});

app.get("/categories", (req, res) => {
  const queryCategoriesSelect = `SELECT * FROM categories`;
  queryRun(queryCategoriesSelect, res);
});

app.get("/categories/:id", (req, res) => {
  const payload = req.query;
  const queryCategoriesSelect = `SELECT * FROM categories_post WHERE post_id = "${req.params.id}"`;
  db.query(queryCategoriesSelect, (err, data) => {
    const { categories_id: category_data } = data;
    if (err) {
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    if (!data) {
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    let values = "";
    data.forEach((element) => {
      values += `${element.categories_id},`;
    });
    let newValues = values.slice(0, values.length - 1);
    const queryCategorySelect = `SELECT * FROM categories WHERE id IN (${newValues})`;
    db.query(queryCategorySelect, (err, categoryData) => {
      if (err) console.log(err);
      res.status(200).json(categoryData);
    });
  });
});

app.get("/category-get", (req, res) => {
  const payload = req.query;
  const queryCategoriesSelect = `SELECT * FROM categories WHERE id = ${payload.id}`;
  queryRun(queryCategoriesSelect, res);
});

app.post("/category-add", (req, res) => {
  const payload = req.body.data;
  const queryCategoryPost = `INSERT INTO categories (title) VALUES (?)`;
  const values = payload.title;
  queryRunWithData(queryCategoryPost, values, res);
});

app.delete("/category-delete", (req, res) => {
  const payload = req.body;
  const queryCategoryPost = `DELETE FROM categories WHERE id = ?`;
  const values = payload.id;
  queryRunWithData(queryCategoryPost, values, res);
});

app.get("/comment/:id", (req, res) => {
  const queryAllCommentsSelect = `SELECT * FROM comments WHERE post_id = ${req.params.id}`;
  queryRun(queryAllCommentsSelect, res);
});

app.post("/posts-add", (req, res) => {
  const payload = req.body.data;
  const queryPostAdd = `INSERT INTO post (name, creator, body) VALUES ("${payload.name}", "${payload.creator}" ,"${payload.body}")`;
  db.query(queryPostAdd, (err, data) => {
    if (err) console.log(err);
    else {
      db.query(`SELECT MAX(id) AS next_id FROM post`, (err, data) => {
        let values = "";
        payload.categoryId.forEach((element) => {
          values += `(${data[0].next_id}, ${element}),`;
        });
        let newValues = values.slice(0, values.length - 1);
        if (err) console.log(err);
        db.query(
          `INSERT INTO categories_post (post_id, categories_id) VALUES ${newValues}`,
          (err, data) => {
            if (err) console.log(err);
            res.status(200).json(data);
          }
        );
      });
    }
  });
});

app.post("/comment/:id", (req, res) => {
  const payload = req.body.data;
  const queryCommentAdd =
    "INSERT into comments (`title`, `username`, `post_id`) VALUES (?)";
  const values = [payload.comment, payload.username, req.params.id];
  queryRunWithData(queryCommentAdd, values, res);
});

app.post("/user-register", (req, res) => {
  const payload = req.body.data;
  const hashedPassword = bcrypt.hashSync(payload.password, 10);
  const queryUserAdd =
    "INSERT into user (`username`, `email`, `password`) VALUES (?)";
  const values = [payload.username, payload.email, hashedPassword];
  queryRunWithData(queryUserAdd, values, res);
});

app.post("/user-login", (req, res) => {
  const { username, password } = req.body.data;

  db.query(
    "SELECT * FROM user WHERE username = ?",
    [username],
    (error, results) => {
      if (error) {
        res.send({ message: "Failed to authenticate." });
      } else if (results.length === 0) {
        res.send({ message: "Invalid username or password." });
      } else {
        let result2 = results;
        const user = results[0];
        const passwordMatch = bcrypt.compareSync(password, user.password);
        if (passwordMatch) {
          const token = jwt.sign(
            { id: user.id, username: user.username },
            "jwtSecret",
            {
              expiresIn: 1800,
            }
          );
          db.query(
            `SELECT * FROM admins WHERE user_admin = ${results[0].id}`,
            (err, result) => {
              if (err) res.send({ err: err });
              if (result.length > 0) {
                res.send({
                  userInfo: result2,
                  adminInfo: result,
                  isAdmin: true,
                  token: token,
                });
              } else {
                res.send({ userInfo: result2, isAdmin: false, token: token });
              }
            }
          );
        } else {
          res.send({ message: "Wrong password." });
        }
      }
    }
  );
});

app.delete("/delete/:id", (req, res) => {
  const deletePostQuery = `DELETE FROM post WHERE id = ${req.params.id}`;
  db.query(deletePostQuery, (err, data) => {
    if (!err) res.status(200).json(data);
    if (err) console.log(err);
    else {
      db.query(
        `DELETE FROM comments WHERE post_id = ${req.params.id}`,
        (err, data) => {
          if (err) console.log(err);
          else {
            const response2 = db.query(
              `DELETE FROM categories_post WHERE post_id = ${req.params.id}`,
              (err, data) => {
                if (err) console.log(err);
                res.status(200).json(response2.data);
              }
            );
          }
        }
      );
    }
  });
});

app.delete("/all-comments-delete/:id", (req, res) => {
  const queryAllCommentsDeleteOnePost = `DELETE FROM comments WHERE post_id = ${req.params.id}`;
  queryRun(queryAllCommentsDeleteOnePost, res);
});

app.delete("/all-comments-delete", (req, res) => {
  const queryAllCommentsDeleteWholePage = `TRUNCATE TABLE comments`;
  queryRun(queryAllCommentsDeleteWholePage, res);
});

app.delete("/all-posts-delete", (req, res) => {
  const queryAllPostsDelete = `TRUNCATE TABLE post`;
  queryRun(queryAllPostsDelete, res);
});

app.delete("/comment-delete", (req, res) => {
  const payload = req.body;
  const commentId = payload.id;
  const querySingleCommentDelete = "DELETE FROM comments WHERE id = ?";
  queryRunWithData(querySingleCommentDelete, commentId, res);
});

const queryRun = (queryString, res) => {
  const dbQuery = db.query(queryString, (err, data) => {
    if (err) return res.json(err);
    res.status(200).json(data);
    return data;
  });
  return dbQuery;
};

const queryRunWithData = (queryString, values, res) => {
  const dbQuery = db.query(queryString, [values], (err, data) => {
    if (err) return res.json(err);
    res.status(200).json(data);
    return data;
  });
  return dbQuery;
};

app.listen(8800, () => {
  console.log("Connected to backend!");
});
