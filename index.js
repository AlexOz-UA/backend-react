import express, { query } from "express";
import mysql from "mysql2";
import cors from "cors";
import jwt, { verify } from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const db = mysql.createPool({
  host: 'monorail.proxy.rlwy.net',
  port: 24206,
  user: 'root',
  password: process.env.DB_PASSWORD,
  database: 'railway',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
const port = process.env.PORT || 3000;

db.getConnection((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
  } else {
    console.log('Connected to MySQL database');
  }
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
    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
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
  db.query(queryAllPostsSelect, (err, results) => {
    try {
      const blogsWithPopularity = [];

      results.forEach((blog, index) => {
        getLikes(blog.id, (err, numLikes) => {
          if (err) {
            return res.status(500).json({ error: "Error fetching likes" });
          }

          const blogWithPopularity = {
            id: blog.id,
            name: blog.name,
            body: blog.body,
            creator: blog.creator,
            num_likes: numLikes,
          };

          blogsWithPopularity.push(blogWithPopularity);

          if (index === results.length - 1) {
            res.status(200).json(blogsWithPopularity);
          }
        });
      });
    } catch (error) {
      console.error("You have an error: " + err);
    }
  });
});

function getLikes(blogId, callback) {
  const queryGetLikes =
    "SELECT COUNT(*) AS num_likes FROM post_likes WHERE post_id = ?";
  db.query(queryGetLikes, [blogId], (err, results) => {
    if (err) {
      console.error("Error fetching likes:", err);
      return callback(err, null);
    }
    callback(null, results[0].num_likes);
  });
}

app.get("/pagination/popular-blogs/:page/:limit", (req, res) => {
  const page = req.params.page;
  const limit = req.params.limit;
  const offset = (page - 1) * limit;

  const queryPopularBlogsSelect = `
    SELECT id, name, body, creator FROM post 
    ORDER BY (SELECT COUNT(*) FROM post_likes WHERE post.id = post_likes.post_id) DESC LIMIT ? OFFSET ?;`;

  const queryTotalPopularBlogs = `
    SELECT COUNT(*) AS totalItems FROM post;`;

  db.query(
    queryPopularBlogsSelect,
    [parseInt(limit), offset],
    (err, results) => {
      if (err) {
        console.log(err);
        return;
      }

      db.query(queryTotalPopularBlogs, (err, data) => {
        if (err) {
          console.log(err);
          return;
        }

        const totalItems = data[0].totalItems;
        const blogsWithPopularity = [];
        
        results.forEach((blog) => {
          const queryLikesCount = `
          SELECT COUNT(*) AS num_likes
          FROM post_likes
          WHERE post_id = ?`;

          db.query(queryLikesCount, [blog.id], (err, likeData) => {
            if (err) {
              console.log(err);
            }

            const blogWithPopularity = {
              id: blog.id,
              name: blog.name,
              body: blog.body,
              creator: blog.creator,
              num_likes: likeData[0].num_likes,
            };
            blogsWithPopularity.push(blogWithPopularity);

            if (blogsWithPopularity.length == results.length) {
              res.status(200).json({ sortedBlogs: blogsWithPopularity, totalItems });
            }
          });
        });
      });
    }
  );
});

app.get("/pagination", (req, res) => {
  const page = req.query.page;
  const limit = req.query.limit;
  const offset = (page - 1) * limit;

  const queryPaginationPostsSelect = "SELECT * FROM post LIMIT ? OFFSET ?";

  db.query(
    queryPaginationPostsSelect,
    [parseInt(limit), offset],
    (err, results) => {
      if (err) {
        console.log(err);
        return;
      }

      const totalItemsQuery = "SELECT COUNT(*) AS totalItems FROM post";
      db.query(totalItemsQuery, (err, data) => {
        if (err) {
          console.log(err);
          return;
        }

        const totalItems = data[0].totalItems;
        const blogsWithPopularity = [];

        results.forEach((blog, index) => {
          getLikes(blog.id, (err, numLikes) => {
            if (err) {
              return res.status(500).json({ error: "Error fetching likes" });
            }
            console.log("RESULTS: " + results);
            console.log("INDEX AND NUM LIKES: " + index, numLikes);
            const blogWithPopularity = {
              id: blog.id,
              name: blog.name,
              body: blog.body,
              creator: blog.creator,
              num_likes: numLikes,
            };

            blogsWithPopularity.push(blogWithPopularity);

            if(index == results.length - 1){
              res.status(200).json({ sortedBlogs: blogsWithPopularity, totalItems });
            }
          });
        });
      });
    }
  );
});

app.post("/pagination/categories", (req, res) => {
  const page = req.query.page;
  const limit = req.query.limit;
  const offset = (page - 1) * limit;

  const categoryIds = req.body.data.id;

  const queryCategoryFilterPaginationSelect = `
    SELECT id, name, body, creator FROM post
    WHERE id IN (SELECT post_id FROM categories_post WHERE categories_id IN (${categoryIds}))
    ORDER BY (SELECT COUNT(*) FROM post_likes WHERE post.id = post_likes.post_id) DESC
    LIMIT ? OFFSET ?;`;

  const queryTotalCategoryBlogs = `
    SELECT COUNT(DISTINCT post.id) AS totalItems FROM post
    WHERE id IN (SELECT post_id FROM categories_post WHERE categories_id IN (${categoryIds}));`;

  db.query(
    queryCategoryFilterPaginationSelect,
    [parseInt(limit), offset],
    (err, results) => {
      if (err) {
        console.log(err);
        return;
      }

      db.query(queryTotalCategoryBlogs, (err, data) => {
        if (err) {
          console.log(err);
          return;
        }

        const totalItems = data[0].totalItems;
        const blogsWithPopularity = [];

        results.forEach((blog) => {
          const queryLikesCount = `
          SELECT COUNT(*) AS num_likes FROM post_likes WHERE post_id = ?`;

          db.query(queryLikesCount, [blog.id], (err, likeData) => {
            if (err) {
              console.log(err);
              return;
            }

            const blogWithPopularity = {
              id: blog.id,
              name: blog.name,
              body: blog.body,
              creator: blog.creator,
              num_likes: likeData[0].num_likes,
            };
            blogsWithPopularity.push(blogWithPopularity);

            if (blogsWithPopularity.length === results.length) {
              res
                .status(200)
                .json({ sortedBlogs: blogsWithPopularity, totalItems });
            }
          });
        });
      });
    }
  );
});

app.post("/pagination/search", (req, res) => {
  const page = req.query.page;
  const limit = req.query.limit;
  const postIds = req.body.data.postIds.join(",");
  const offset = (page - 1) * limit;

  const querySearchPaginationSelect = `
    SELECT id, name, body, creator FROM post
    WHERE id IN (${postIds})
    ORDER BY (SELECT COUNT(*) FROM post_likes WHERE post.id = post_likes.post_id) DESC
    LIMIT ? OFFSET ?;`;

  const queryTotalSearchBlogs = `
    SELECT COUNT(*) AS totalItems FROM post
    WHERE id IN (${postIds});`;

  db.query(
    querySearchPaginationSelect,
    [parseInt(limit), offset],
    (err, results) => {
      if (err) {
        console.log(err);
        return;
      }

      db.query(queryTotalSearchBlogs, (err, data) => {
        if (err) {
          console.log(err);
          return;
        }

        const totalItems = data[0].totalItems;
        const blogsWithPopularity = [];

        results.forEach((blog) => {
          const queryLikesCount = `
          SELECT COUNT(*) AS num_likes FROM post_likes WHERE post_id = ?`;

          db.query(queryLikesCount, [blog.id], (err, likeData) => {
            if (err) {
              console.log(err);
              return;
            }

            const blogWithPopularity = {
              id: blog.id,
              name: blog.name,
              body: blog.body,
              creator: blog.creator,
              num_likes: likeData[0].num_likes,
            };
            blogsWithPopularity.push(blogWithPopularity);

            if (blogsWithPopularity.length === results.length) {
              res
                .status(200)
                .json({ sortedBlogs: blogsWithPopularity, totalItems });
            }
          });
        });
      });
    }
  );
});

app.get("/posts-liked/:user_id", verifyJWT, (req, res) => {
  const queryLikedPostsSelect = `SELECT * FROM post_likes WHERE user_id = ${req.params.user_id}`;
  db.query(queryLikedPostsSelect, (err, data) => {
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
      values += `${element.post_id},`;
    });
    let newValues = values.slice(0, values.length - 1);
    console.log(newValues);
    const queryCategorySelect = `SELECT * FROM post WHERE id IN (${newValues})`;
    db.query(queryCategorySelect, (err, categoryData) => {
      if (err) console.log(err);
      res.status(200).json(categoryData);
    });
  });
});

app.get("/post/:id", (req, res) => {
  const queryOnePostSelect = `SELECT * FROM post WHERE id = ${req.params.id}`;
  queryRun(queryOnePostSelect, res);
});

app.post("/post/like/:id", (req, res) => {
  const payload = req.body.data;
  const queryPostLike = "INSERT INTO post_likes (user_id, post_id) VALUES (?)";
  const values = [payload.user_id, req.params.id];
  queryRunWithData(queryPostLike, values, res);
});

app.post("/post/unlike/:id", (req, res) => {
  const payload = req.body.data;
  const queryPostUnlike = `DELETE FROM post_likes WHERE user_id = (?) AND post_id = ${req.params.id}`;
  const values = [payload.user_id];
  queryRunWithData(queryPostUnlike, values, res);
});

app.get("/post/is-liked/:id/:user_id", (req, res) => {
  const queryPostIsliked = `SELECT * FROM post_likes WHERE user_id = ${req.params.user_id} AND post_id = ${req.params.id}`;
  db.query(queryPostIsliked, (err, data) => {
    console.log(data);
    if (err) {
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    if (data[0] && data[0].id) {
      console.log(data);
      res.status(200).json({ likeStatus: true });
    } else {
      res.status(200).json({ likeStatus: false });
    }
  });
});

app.get("/post/likes-count/:id", (req, res) => {
  const queryPostIsliked = `SELECT COUNT (id) AS count FROM post_likes WHERE post_id = ${req.params.id};`;
  db.query(queryPostIsliked, (err, data) => {
    console.log(data);
    if (err) {
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    if (!data) {
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    res.status(200).json(data);
  });
});

app.get("/posts-saved/:user_id", verifyJWT, (req, res) => {
  const querySavedPostsSelect = `SELECT * FROM post_saved WHERE user_id = ${req.params.user_id}`;
  db.query(querySavedPostsSelect, (err, data) => {
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
      values += `${element.post_id},`;
    });
    let newValues = values.slice(0, values.length - 1);
    console.log(newValues);
    const queryCategorySelect = `SELECT * FROM post WHERE id IN (${newValues})`;
    db.query(queryCategorySelect, (err, categoryData) => {
      if (err) console.log(err);
      res.status(200).json(categoryData);
    });
  });
});

app.post("/post/save/:id", (req, res) => {
  const payload = req.body.data;
  const queryPostsave = "INSERT INTO post_saved (user_id, post_id) VALUES (?)";
  const values = [payload.user_id, req.params.id];
  queryRunWithData(queryPostsave, values, res);
});

app.post("/post/unsave/:id", (req, res) => {
  const payload = req.body.data;
  const queryPostUnsave = `DELETE FROM post_saved WHERE user_id = (?) AND post_id = ${req.params.id}`;
  const values = [payload.user_id];
  queryRunWithData(queryPostUnsave, values, res);
});

app.get("/post/is-saved/:id/:user_id", (req, res) => {
  const queryPostIssaved = `SELECT * FROM post_saved WHERE user_id = ${req.params.user_id} AND post_id = ${req.params.id}`;
  db.query(queryPostIssaved, (err, data) => {
    console.log(data);
    if (err) {
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    if (data[0] && data[0].id) {
      console.log(data);
      res.status(200).json({ savedStatus: true });
    } else {
      res.status(200).json({ savedStatus: false });
    }
  });
});

app.get("/post/saved-count/:id", (req, res) => {
  const queryPostIsliked = `SELECT COUNT (id) AS count FROM post_saved WHERE post_id = ${req.params.id};`;
  db.query(queryPostIsliked, (err, data) => {
    console.log(data);
    if (err) {
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    if (!data) {
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    res.status(200).json(data);
  });
});

app.get("/categories", (req, res) => {
  const queryCategoriesSelect = `SELECT * FROM categories`;
  queryRun(queryCategoriesSelect, res);
});

app.post("/categories-filter", (req, res) => {
  const queryCategoryFilterSelect = `SELECT * FROM categories_post WHERE categories_id IN (${req.body.data.id})`;
  db.query(queryCategoryFilterSelect, (err, data) => {
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
      values += `${element.post_id},`;
    });
    let newValues = values.slice(0, values.length - 1);
    console.log(newValues);
    const queryCategorySelect = `SELECT * FROM post WHERE id IN (${newValues})`;
    db.query(queryCategorySelect, (err, categoryData) => {
      if (err) console.log(err);
      res.status(200).json(categoryData);
    });
  });
});

app.post("/search-bar", (req, res) => {
  console.log(req.body.data.searchBar);
  const searchBarBlogsQuery = `SELECT * FROM post WHERE name LIKE '${req.body.data.searchBar}%'`;
  db.query(searchBarBlogsQuery, (err, data) => {
    if (err) {
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    if (!data) {
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    res.status(200).json(data);
  });
});

app.get("/categories/:id", (req, res) => {
  const payload = req.query;
  const queryCategoriesSelect = `SELECT * FROM categories_post WHERE post_id = "${req.params.id}"`;
  db.query(queryCategoriesSelect, (err, data) => {
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
        console.log(payload.categoryId);
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
  var payload = req.body.data;
  db.query(
    `SELECT * FROM patron WHERE email = "${payload.email}" OR username = "${payload.username}"`,
    (err, data) => {
      if (err) {
        console.log(err);
        return;
      }
      if (data == "") {
        const hashedPassword = bcrypt.hashSync(payload.password, 10);
        const queryUserAdd =
          "INSERT into patron (`username`, `email`, `password`) VALUES (?)";
        const values = [payload.username, payload.email, hashedPassword];
        queryRunWithData(queryUserAdd, values, res);
      }

      if (data != "") {
        res.status(200).send({message: "This user already exists."});
        return;
      }
    }
  );
});

app.post("/user-login", (req, res) => {
  const { username, password } = req.body.data;

  db.query(
    "SELECT * FROM patron WHERE username = ?",
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
            process.env.JWT_SECRET_KEY,
            {
              expiresIn: 604800,
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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
