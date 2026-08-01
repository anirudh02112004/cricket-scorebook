const dns = require("dns");

dns.resolveSrv(
  "_mongodb._tcp.stationery-shop-cluster.n0ysdh1.mongodb.net",
  (err, records) => {
    console.log("Error:", err);
    console.log("Records:", records);
  }
);