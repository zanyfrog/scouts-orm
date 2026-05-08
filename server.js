"use strict";

delete require.cache[require.resolve("./src/config/env")];
delete require.cache[require.resolve("./src/http/server")];
const serverModule = require("./src/http/server");

if (require.main === module) {
  serverModule.server.listen(serverModule.port, () => {
    console.log(`Scout ORM server running at http://0.0.0.0:${serverModule.port}`);
  });
}

module.exports = serverModule;
