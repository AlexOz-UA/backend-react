import express from "express";
import mysql from "mysql";
import cors from "cors";

const app = express();
const db = mysql.createConnection({
  host: "localhost",
  user: "mysql",
  password: "mysql",
  database: "myfirstdb",
});

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.json("hello, this is the backend");
});

app.get("/posts", (req, res) => {
  const q = "SELECT * FROM post";
  db.query(q, (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.get("/post/:id", (req, res) => {
  const q = `SELECT * FROM post WHERE id = ${req.params.id}`;
  db.query(q, (err, data) => {
    if (err) return res.json(err);
    return res.json(data[0]);
  });
});

app.get("/comment/:id", (req, res) => {
  const q = `SELECT * FROM comments WHERE post_id = ${req.params.id}`;
  db.query(q, (err, data) => {
    if (err) return res.json(err);
    return res.json(data);
  });
});

app.post("/postsadd", (req, res) => {
  const payload = req.body
  const q =
  "INSERT INTO post (`name`, `category`) VALUES (?)";
  const values = [payload.name, payload.category];
  db.query(q, [values], (err, data) => {
  if (err) return res.json(err);

  //   console.log(req.body)

    res.status(200).json(data)
});
})

app.post("/update/:id", (req, res) => {
  const payload = req.body
  const q =
  `UPDATE post SET comment = '${payload.comment}' WHERE id = '${req.params.id}'`;
  db.query(q, (err, data) => {
  if (err) return res.json(err);

  //   console.log(req.body)

    res.status(200).json(data)
});
})

app.post("/comment/:id", (req, res) => {
  const payload = req.body
  const q =
  "INSERT into comments (`title`, `username` ,`post_id`) VALUES (?)";
  const values = [payload.comment, payload.username, req.params.id]
  db.query(q, [values], (err, data) => {
  if (err) return res.json(err);
    res.status(200).json(data)
});
})

app.delete("/delete/:id", (req, res) => {
  const q =
  `DELETE FROM post WHERE id = ${req.params.id}`;
  db.query(q, (err, data) => {
  if (err) return res.json(err);
    res.status(200).json(data)
});
})

app.delete("/commentdelete/:id", (req, res) => {
  const q =
  `DELETE FROM comments WHERE post_id = ${req.params.id}`;
  db.query(q, (err, data) => {
  if (err) return res.json(err);
    res.status(200).json(data)
});
})

app.delete("/allcommentsdelete/:id", (req, res) => {
  const q =
  `DELETE FROM comments WHERE post_id = ${req.params.id}`;
  db.query(q, (err, data) => {
  if (err) return res.json(err);
    res.status(200).json(data)
});
})

app.delete("/allcommentsdelete", (req, res) => {
  const q =
  `DELETE FROM comments WHERE id >= 1`;
  db.query(q, (err, data) => {
  if (err) return res.json(err);
    res.status(200).json(data)
});
})

app.delete("/allpostsdelete", (req, res) => {
  const q =
  `DELETE FROM post WHERE id >= 1`;
  db.query(q, (err, data) => {
  if (err) return res.json(err);
    res.status(200).json(data)
});
})

app.delete('/commentdelete', (req, res) => {
  const payload = req.body
  const commentId = payload.id;
  const query = 'DELETE FROM comments WHERE id = ?';
  db.query(query, [commentId], (error, results) => {
    if (error) {
      console.error('Error deleting comment:', error);
      res.status(500).send('Error deleting comment');
    } else {
      console.log(payload.id);
      console.log('Comment deleted successfully');
      res.sendStatus(200);
    }
  });
});

app.listen(8800, () => {
  console.log("Connected to backend!");
});