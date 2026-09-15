const app = require("./app");
const { port } = require("./config");

app.listen(port, () => {
  console.log(`Gen-Vocher server running at http://localhost:${port}`);
});
