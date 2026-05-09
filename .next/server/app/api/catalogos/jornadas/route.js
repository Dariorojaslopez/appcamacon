"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/catalogos/jornadas/route";
exports.ids = ["app/api/catalogos/jornadas/route"];
exports.modules = {

/***/ "@prisma/client":
/*!*********************************!*\
  !*** external "@prisma/client" ***!
  \*********************************/
/***/ ((module) => {

module.exports = require("@prisma/client");

/***/ }),

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ }),

/***/ "buffer":
/*!*************************!*\
  !*** external "buffer" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("buffer");

/***/ }),

/***/ "crypto":
/*!*************************!*\
  !*** external "crypto" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ "stream":
/*!*************************!*\
  !*** external "stream" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("stream");

/***/ }),

/***/ "util":
/*!***********************!*\
  !*** external "util" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("util");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fcatalogos%2Fjornadas%2Froute&page=%2Fapi%2Fcatalogos%2Fjornadas%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fcatalogos%2Fjornadas%2Froute.ts&appDir=D%3A%5CConstructora%5CConstructora_Camacon%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=D%3A%5CConstructora%5CConstructora_Camacon&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!****************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fcatalogos%2Fjornadas%2Froute&page=%2Fapi%2Fcatalogos%2Fjornadas%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fcatalogos%2Fjornadas%2Froute.ts&appDir=D%3A%5CConstructora%5CConstructora_Camacon%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=D%3A%5CConstructora%5CConstructora_Camacon&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \****************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   originalPathname: () => (/* binding */ originalPathname),\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   requestAsyncStorage: () => (/* binding */ requestAsyncStorage),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   staticGenerationAsyncStorage: () => (/* binding */ staticGenerationAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/future/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/future/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/future/route-kind */ \"(rsc)/./node_modules/next/dist/server/future/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var D_Constructora_Constructora_Camacon_app_api_catalogos_jornadas_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/catalogos/jornadas/route.ts */ \"(rsc)/./app/api/catalogos/jornadas/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/catalogos/jornadas/route\",\n        pathname: \"/api/catalogos/jornadas\",\n        filename: \"route\",\n        bundlePath: \"app/api/catalogos/jornadas/route\"\n    },\n    resolvedPagePath: \"D:\\\\Constructora\\\\Constructora_Camacon\\\\app\\\\api\\\\catalogos\\\\jornadas\\\\route.ts\",\n    nextConfigOutput,\n    userland: D_Constructora_Constructora_Camacon_app_api_catalogos_jornadas_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { requestAsyncStorage, staticGenerationAsyncStorage, serverHooks } = routeModule;\nconst originalPathname = \"/api/catalogos/jornadas/route\";\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        serverHooks,\n        staticGenerationAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIuanM/bmFtZT1hcHAlMkZhcGklMkZjYXRhbG9nb3MlMkZqb3JuYWRhcyUyRnJvdXRlJnBhZ2U9JTJGYXBpJTJGY2F0YWxvZ29zJTJGam9ybmFkYXMlMkZyb3V0ZSZhcHBQYXRocz0mcGFnZVBhdGg9cHJpdmF0ZS1uZXh0LWFwcC1kaXIlMkZhcGklMkZjYXRhbG9nb3MlMkZqb3JuYWRhcyUyRnJvdXRlLnRzJmFwcERpcj1EJTNBJTVDQ29uc3RydWN0b3JhJTVDQ29uc3RydWN0b3JhX0NhbWFjb24lNUNhcHAmcGFnZUV4dGVuc2lvbnM9dHN4JnBhZ2VFeHRlbnNpb25zPXRzJnBhZ2VFeHRlbnNpb25zPWpzeCZwYWdlRXh0ZW5zaW9ucz1qcyZyb290RGlyPUQlM0ElNUNDb25zdHJ1Y3RvcmElNUNDb25zdHJ1Y3RvcmFfQ2FtYWNvbiZpc0Rldj10cnVlJnRzY29uZmlnUGF0aD10c2NvbmZpZy5qc29uJmJhc2VQYXRoPSZhc3NldFByZWZpeD0mbmV4dENvbmZpZ091dHB1dD0mcHJlZmVycmVkUmVnaW9uPSZtaWRkbGV3YXJlQ29uZmlnPWUzMCUzRCEiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7O0FBQXNHO0FBQ3ZDO0FBQ2M7QUFDK0I7QUFDNUc7QUFDQTtBQUNBO0FBQ0Esd0JBQXdCLGdIQUFtQjtBQUMzQztBQUNBLGNBQWMseUVBQVM7QUFDdkI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBLFlBQVk7QUFDWixDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0EsUUFBUSxpRUFBaUU7QUFDekU7QUFDQTtBQUNBLFdBQVcsNEVBQVc7QUFDdEI7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUN1SDs7QUFFdkgiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9zaWdvY2MtY29yZS8/ZGFjMSJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHBSb3V0ZVJvdXRlTW9kdWxlIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvZnV0dXJlL3JvdXRlLW1vZHVsZXMvYXBwLXJvdXRlL21vZHVsZS5jb21waWxlZFwiO1xuaW1wb3J0IHsgUm91dGVLaW5kIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvZnV0dXJlL3JvdXRlLWtpbmRcIjtcbmltcG9ydCB7IHBhdGNoRmV0Y2ggYXMgX3BhdGNoRmV0Y2ggfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9saWIvcGF0Y2gtZmV0Y2hcIjtcbmltcG9ydCAqIGFzIHVzZXJsYW5kIGZyb20gXCJEOlxcXFxDb25zdHJ1Y3RvcmFcXFxcQ29uc3RydWN0b3JhX0NhbWFjb25cXFxcYXBwXFxcXGFwaVxcXFxjYXRhbG9nb3NcXFxcam9ybmFkYXNcXFxccm91dGUudHNcIjtcbi8vIFdlIGluamVjdCB0aGUgbmV4dENvbmZpZ091dHB1dCBoZXJlIHNvIHRoYXQgd2UgY2FuIHVzZSB0aGVtIGluIHRoZSByb3V0ZVxuLy8gbW9kdWxlLlxuY29uc3QgbmV4dENvbmZpZ091dHB1dCA9IFwiXCJcbmNvbnN0IHJvdXRlTW9kdWxlID0gbmV3IEFwcFJvdXRlUm91dGVNb2R1bGUoe1xuICAgIGRlZmluaXRpb246IHtcbiAgICAgICAga2luZDogUm91dGVLaW5kLkFQUF9ST1VURSxcbiAgICAgICAgcGFnZTogXCIvYXBpL2NhdGFsb2dvcy9qb3JuYWRhcy9yb3V0ZVwiLFxuICAgICAgICBwYXRobmFtZTogXCIvYXBpL2NhdGFsb2dvcy9qb3JuYWRhc1wiLFxuICAgICAgICBmaWxlbmFtZTogXCJyb3V0ZVwiLFxuICAgICAgICBidW5kbGVQYXRoOiBcImFwcC9hcGkvY2F0YWxvZ29zL2pvcm5hZGFzL3JvdXRlXCJcbiAgICB9LFxuICAgIHJlc29sdmVkUGFnZVBhdGg6IFwiRDpcXFxcQ29uc3RydWN0b3JhXFxcXENvbnN0cnVjdG9yYV9DYW1hY29uXFxcXGFwcFxcXFxhcGlcXFxcY2F0YWxvZ29zXFxcXGpvcm5hZGFzXFxcXHJvdXRlLnRzXCIsXG4gICAgbmV4dENvbmZpZ091dHB1dCxcbiAgICB1c2VybGFuZFxufSk7XG4vLyBQdWxsIG91dCB0aGUgZXhwb3J0cyB0aGF0IHdlIG5lZWQgdG8gZXhwb3NlIGZyb20gdGhlIG1vZHVsZS4gVGhpcyBzaG91bGRcbi8vIGJlIGVsaW1pbmF0ZWQgd2hlbiB3ZSd2ZSBtb3ZlZCB0aGUgb3RoZXIgcm91dGVzIHRvIHRoZSBuZXcgZm9ybWF0LiBUaGVzZVxuLy8gYXJlIHVzZWQgdG8gaG9vayBpbnRvIHRoZSByb3V0ZS5cbmNvbnN0IHsgcmVxdWVzdEFzeW5jU3RvcmFnZSwgc3RhdGljR2VuZXJhdGlvbkFzeW5jU3RvcmFnZSwgc2VydmVySG9va3MgfSA9IHJvdXRlTW9kdWxlO1xuY29uc3Qgb3JpZ2luYWxQYXRobmFtZSA9IFwiL2FwaS9jYXRhbG9nb3Mvam9ybmFkYXMvcm91dGVcIjtcbmZ1bmN0aW9uIHBhdGNoRmV0Y2goKSB7XG4gICAgcmV0dXJuIF9wYXRjaEZldGNoKHtcbiAgICAgICAgc2VydmVySG9va3MsXG4gICAgICAgIHN0YXRpY0dlbmVyYXRpb25Bc3luY1N0b3JhZ2VcbiAgICB9KTtcbn1cbmV4cG9ydCB7IHJvdXRlTW9kdWxlLCByZXF1ZXN0QXN5bmNTdG9yYWdlLCBzdGF0aWNHZW5lcmF0aW9uQXN5bmNTdG9yYWdlLCBzZXJ2ZXJIb29rcywgb3JpZ2luYWxQYXRobmFtZSwgcGF0Y2hGZXRjaCwgIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWFwcC1yb3V0ZS5qcy5tYXAiXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fcatalogos%2Fjornadas%2Froute&page=%2Fapi%2Fcatalogos%2Fjornadas%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fcatalogos%2Fjornadas%2Froute.ts&appDir=D%3A%5CConstructora%5CConstructora_Camacon%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=D%3A%5CConstructora%5CConstructora_Camacon&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./app/api/catalogos/jornadas/route.ts":
/*!*********************************************!*\
  !*** ./app/api/catalogos/jornadas/route.ts ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   GET: () => (/* binding */ GET)\n/* harmony export */ });\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(rsc)/./node_modules/next/dist/api/server.js\");\n/* harmony import */ var _src_lib_prisma__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../../../src/lib/prisma */ \"(rsc)/./src/lib/prisma.ts\");\n/* harmony import */ var _src_infrastructure_auth_tokens__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../../../src/infrastructure/auth/tokens */ \"(rsc)/./src/infrastructure/auth/tokens.ts\");\n\n\n\nasync function GET(req) {\n    try {\n        const authCookie = req.cookies.get(\"access_token\")?.value;\n        if (!authCookie) return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"No autenticado\"\n        }, {\n            status: 401\n        });\n        (0,_src_infrastructure_auth_tokens__WEBPACK_IMPORTED_MODULE_2__.verifyAccessToken)(authCookie);\n        const items = await _src_lib_prisma__WEBPACK_IMPORTED_MODULE_1__[\"default\"].jornadaCatalog.findMany({\n            where: {\n                isActive: true\n            },\n            orderBy: [\n                {\n                    orden: \"asc\"\n                },\n                {\n                    nombre: \"asc\"\n                }\n            ],\n            select: {\n                id: true,\n                nombre: true,\n                horaInicio: true,\n                horaFin: true,\n                orden: true\n            }\n        });\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            items\n        });\n    } catch (error) {\n        const err = error;\n        if (err.name === \"TokenExpiredError\" || err.name === \"JsonWebTokenError\") {\n            return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n                error: \"Sesi\\xf3n expirada\"\n            }, {\n                status: 401\n            });\n        }\n        console.error(error);\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Error al cargar jornadas\"\n        }, {\n            status: 500\n        });\n    }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9hcHAvYXBpL2NhdGFsb2dvcy9qb3JuYWRhcy9yb3V0ZS50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQXdEO0FBQ1I7QUFDK0I7QUFFeEUsZUFBZUcsSUFBSUMsR0FBZ0I7SUFDeEMsSUFBSTtRQUNGLE1BQU1DLGFBQWFELElBQUlFLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDLGlCQUFpQkM7UUFDcEQsSUFBSSxDQUFDSCxZQUFZLE9BQU9MLHFEQUFZQSxDQUFDUyxJQUFJLENBQUM7WUFBRUMsT0FBTztRQUFpQixHQUFHO1lBQUVDLFFBQVE7UUFBSTtRQUNyRlQsa0ZBQWlCQSxDQUFDRztRQUVsQixNQUFNTyxRQUFRLE1BQU1YLHVEQUFNQSxDQUFDWSxjQUFjLENBQUNDLFFBQVEsQ0FBQztZQUNqREMsT0FBTztnQkFBRUMsVUFBVTtZQUFLO1lBQ3hCQyxTQUFTO2dCQUFDO29CQUFFQyxPQUFPO2dCQUFNO2dCQUFHO29CQUFFQyxRQUFRO2dCQUFNO2FBQUU7WUFDOUNDLFFBQVE7Z0JBQUVDLElBQUk7Z0JBQU1GLFFBQVE7Z0JBQU1HLFlBQVk7Z0JBQU1DLFNBQVM7Z0JBQU1MLE9BQU87WUFBSztRQUNqRjtRQUVBLE9BQU9sQixxREFBWUEsQ0FBQ1MsSUFBSSxDQUFDO1lBQUVHO1FBQU07SUFDbkMsRUFBRSxPQUFPRixPQUFnQjtRQUN2QixNQUFNYyxNQUFNZDtRQUNaLElBQUljLElBQUlDLElBQUksS0FBSyx1QkFBdUJELElBQUlDLElBQUksS0FBSyxxQkFBcUI7WUFDeEUsT0FBT3pCLHFEQUFZQSxDQUFDUyxJQUFJLENBQUM7Z0JBQUVDLE9BQU87WUFBa0IsR0FBRztnQkFBRUMsUUFBUTtZQUFJO1FBQ3ZFO1FBQ0FlLFFBQVFoQixLQUFLLENBQUNBO1FBQ2QsT0FBT1YscURBQVlBLENBQUNTLElBQUksQ0FBQztZQUFFQyxPQUFPO1FBQTJCLEdBQUc7WUFBRUMsUUFBUTtRQUFJO0lBQ2hGO0FBQ0YiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9zaWdvY2MtY29yZS8uL2FwcC9hcGkvY2F0YWxvZ29zL2pvcm5hZGFzL3JvdXRlLnRzPzM4ZmIiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTmV4dFJlcXVlc3QsIE5leHRSZXNwb25zZSB9IGZyb20gJ25leHQvc2VydmVyJztcclxuaW1wb3J0IHByaXNtYSBmcm9tICcuLi8uLi8uLi8uLi9zcmMvbGliL3ByaXNtYSc7XHJcbmltcG9ydCB7IHZlcmlmeUFjY2Vzc1Rva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vc3JjL2luZnJhc3RydWN0dXJlL2F1dGgvdG9rZW5zJztcclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBHRVQocmVxOiBOZXh0UmVxdWVzdCkge1xyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBhdXRoQ29va2llID0gcmVxLmNvb2tpZXMuZ2V0KCdhY2Nlc3NfdG9rZW4nKT8udmFsdWU7XHJcbiAgICBpZiAoIWF1dGhDb29raWUpIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiAnTm8gYXV0ZW50aWNhZG8nIH0sIHsgc3RhdHVzOiA0MDEgfSk7XHJcbiAgICB2ZXJpZnlBY2Nlc3NUb2tlbihhdXRoQ29va2llKTtcclxuXHJcbiAgICBjb25zdCBpdGVtcyA9IGF3YWl0IHByaXNtYS5qb3JuYWRhQ2F0YWxvZy5maW5kTWFueSh7XHJcbiAgICAgIHdoZXJlOiB7IGlzQWN0aXZlOiB0cnVlIH0sXHJcbiAgICAgIG9yZGVyQnk6IFt7IG9yZGVuOiAnYXNjJyB9LCB7IG5vbWJyZTogJ2FzYycgfV0sXHJcbiAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgbm9tYnJlOiB0cnVlLCBob3JhSW5pY2lvOiB0cnVlLCBob3JhRmluOiB0cnVlLCBvcmRlbjogdHJ1ZSB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgaXRlbXMgfSk7XHJcbiAgfSBjYXRjaCAoZXJyb3I6IHVua25vd24pIHtcclxuICAgIGNvbnN0IGVyciA9IGVycm9yIGFzIHsgbmFtZT86IHN0cmluZyB9O1xyXG4gICAgaWYgKGVyci5uYW1lID09PSAnVG9rZW5FeHBpcmVkRXJyb3InIHx8IGVyci5uYW1lID09PSAnSnNvbldlYlRva2VuRXJyb3InKSB7XHJcbiAgICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiAnU2VzacOzbiBleHBpcmFkYScgfSwgeyBzdGF0dXM6IDQwMSB9KTtcclxuICAgIH1cclxuICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6ICdFcnJvciBhbCBjYXJnYXIgam9ybmFkYXMnIH0sIHsgc3RhdHVzOiA1MDAgfSk7XHJcbiAgfVxyXG59XHJcbiJdLCJuYW1lcyI6WyJOZXh0UmVzcG9uc2UiLCJwcmlzbWEiLCJ2ZXJpZnlBY2Nlc3NUb2tlbiIsIkdFVCIsInJlcSIsImF1dGhDb29raWUiLCJjb29raWVzIiwiZ2V0IiwidmFsdWUiLCJqc29uIiwiZXJyb3IiLCJzdGF0dXMiLCJpdGVtcyIsImpvcm5hZGFDYXRhbG9nIiwiZmluZE1hbnkiLCJ3aGVyZSIsImlzQWN0aXZlIiwib3JkZXJCeSIsIm9yZGVuIiwibm9tYnJlIiwic2VsZWN0IiwiaWQiLCJob3JhSW5pY2lvIiwiaG9yYUZpbiIsImVyciIsIm5hbWUiLCJjb25zb2xlIl0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./app/api/catalogos/jornadas/route.ts\n");

/***/ }),

/***/ "(rsc)/./src/infrastructure/auth/tokens.ts":
/*!*******************************************!*\
  !*** ./src/infrastructure/auth/tokens.ts ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   signAccessToken: () => (/* binding */ signAccessToken),\n/* harmony export */   signRefreshToken: () => (/* binding */ signRefreshToken),\n/* harmony export */   verifyAccessToken: () => (/* binding */ verifyAccessToken),\n/* harmony export */   verifyRefreshToken: () => (/* binding */ verifyRefreshToken)\n/* harmony export */ });\n/* harmony import */ var jsonwebtoken__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! jsonwebtoken */ \"(rsc)/./node_modules/jsonwebtoken/index.js\");\n/* harmony import */ var jsonwebtoken__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(jsonwebtoken__WEBPACK_IMPORTED_MODULE_0__);\n\nconst accessSecret = process.env.JWT_ACCESS_SECRET || \"dev-access-secret\";\nconst refreshSecret = process.env.JWT_REFRESH_SECRET || \"dev-refresh-secret\";\nconst accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || \"15m\";\nconst refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || \"7d\";\nfunction signAccessToken(payload) {\n    return jsonwebtoken__WEBPACK_IMPORTED_MODULE_0___default().sign(payload, accessSecret, {\n        expiresIn: accessExpiresIn\n    });\n}\nfunction signRefreshToken(payload) {\n    return jsonwebtoken__WEBPACK_IMPORTED_MODULE_0___default().sign(payload, refreshSecret, {\n        expiresIn: refreshExpiresIn\n    });\n}\nfunction verifyAccessToken(token) {\n    return jsonwebtoken__WEBPACK_IMPORTED_MODULE_0___default().verify(token, accessSecret);\n}\nfunction verifyRefreshToken(token) {\n    return jsonwebtoken__WEBPACK_IMPORTED_MODULE_0___default().verify(token, refreshSecret);\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9zcmMvaW5mcmFzdHJ1Y3R1cmUvYXV0aC90b2tlbnMudHMiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQStCO0FBRS9CLE1BQU1DLGVBQWVDLFFBQVFDLEdBQUcsQ0FBQ0MsaUJBQWlCLElBQUk7QUFDdEQsTUFBTUMsZ0JBQWdCSCxRQUFRQyxHQUFHLENBQUNHLGtCQUFrQixJQUFJO0FBRXhELE1BQU1DLGtCQUFrQkwsUUFBUUMsR0FBRyxDQUFDSyxxQkFBcUIsSUFBSTtBQUM3RCxNQUFNQyxtQkFBbUJQLFFBQVFDLEdBQUcsQ0FBQ08sc0JBQXNCLElBQUk7QUFVeEQsU0FBU0MsZ0JBQWdCQyxPQUFtQjtJQUNqRCxPQUFPWix3REFBUSxDQUFDWSxTQUFTWCxjQUFjO1FBQUVhLFdBQVdQO0lBQWdCO0FBQ3RFO0FBRU8sU0FBU1EsaUJBQWlCSCxPQUFtQjtJQUNsRCxPQUFPWix3REFBUSxDQUFDWSxTQUFTUCxlQUFlO1FBQUVTLFdBQVdMO0lBQWlCO0FBQ3hFO0FBRU8sU0FBU08sa0JBQWtCQyxLQUFhO0lBQzdDLE9BQU9qQiwwREFBVSxDQUFDaUIsT0FBT2hCO0FBQzNCO0FBRU8sU0FBU2tCLG1CQUFtQkYsS0FBYTtJQUM5QyxPQUFPakIsMERBQVUsQ0FBQ2lCLE9BQU9aO0FBQzNCIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vc2lnb2NjLWNvcmUvLi9zcmMvaW5mcmFzdHJ1Y3R1cmUvYXV0aC90b2tlbnMudHM/MDUxMiJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgand0IGZyb20gJ2pzb253ZWJ0b2tlbic7XHJcblxyXG5jb25zdCBhY2Nlc3NTZWNyZXQgPSBwcm9jZXNzLmVudi5KV1RfQUNDRVNTX1NFQ1JFVCB8fCAnZGV2LWFjY2Vzcy1zZWNyZXQnO1xyXG5jb25zdCByZWZyZXNoU2VjcmV0ID0gcHJvY2Vzcy5lbnYuSldUX1JFRlJFU0hfU0VDUkVUIHx8ICdkZXYtcmVmcmVzaC1zZWNyZXQnO1xyXG5cclxuY29uc3QgYWNjZXNzRXhwaXJlc0luID0gcHJvY2Vzcy5lbnYuSldUX0FDQ0VTU19FWFBJUkVTX0lOIHx8ICcxNW0nO1xyXG5jb25zdCByZWZyZXNoRXhwaXJlc0luID0gcHJvY2Vzcy5lbnYuSldUX1JFRlJFU0hfRVhQSVJFU19JTiB8fCAnN2QnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBKd3RQYXlsb2FkIHtcclxuICBzdWI6IHN0cmluZztcclxuICBpZGVudGlmaWNhdGlvbjogc3RyaW5nO1xyXG4gIGVtYWlsOiBzdHJpbmc7XHJcbiAgbmFtZTogc3RyaW5nO1xyXG4gIHJvbGU6IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNpZ25BY2Nlc3NUb2tlbihwYXlsb2FkOiBKd3RQYXlsb2FkKSB7XHJcbiAgcmV0dXJuIGp3dC5zaWduKHBheWxvYWQsIGFjY2Vzc1NlY3JldCwgeyBleHBpcmVzSW46IGFjY2Vzc0V4cGlyZXNJbiB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNpZ25SZWZyZXNoVG9rZW4ocGF5bG9hZDogSnd0UGF5bG9hZCkge1xyXG4gIHJldHVybiBqd3Quc2lnbihwYXlsb2FkLCByZWZyZXNoU2VjcmV0LCB7IGV4cGlyZXNJbjogcmVmcmVzaEV4cGlyZXNJbiB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHZlcmlmeUFjY2Vzc1Rva2VuKHRva2VuOiBzdHJpbmcpOiBKd3RQYXlsb2FkIHtcclxuICByZXR1cm4gand0LnZlcmlmeSh0b2tlbiwgYWNjZXNzU2VjcmV0KSBhcyBKd3RQYXlsb2FkO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gdmVyaWZ5UmVmcmVzaFRva2VuKHRva2VuOiBzdHJpbmcpOiBKd3RQYXlsb2FkIHtcclxuICByZXR1cm4gand0LnZlcmlmeSh0b2tlbiwgcmVmcmVzaFNlY3JldCkgYXMgSnd0UGF5bG9hZDtcclxufVxyXG5cclxuIl0sIm5hbWVzIjpbImp3dCIsImFjY2Vzc1NlY3JldCIsInByb2Nlc3MiLCJlbnYiLCJKV1RfQUNDRVNTX1NFQ1JFVCIsInJlZnJlc2hTZWNyZXQiLCJKV1RfUkVGUkVTSF9TRUNSRVQiLCJhY2Nlc3NFeHBpcmVzSW4iLCJKV1RfQUNDRVNTX0VYUElSRVNfSU4iLCJyZWZyZXNoRXhwaXJlc0luIiwiSldUX1JFRlJFU0hfRVhQSVJFU19JTiIsInNpZ25BY2Nlc3NUb2tlbiIsInBheWxvYWQiLCJzaWduIiwiZXhwaXJlc0luIiwic2lnblJlZnJlc2hUb2tlbiIsInZlcmlmeUFjY2Vzc1Rva2VuIiwidG9rZW4iLCJ2ZXJpZnkiLCJ2ZXJpZnlSZWZyZXNoVG9rZW4iXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./src/infrastructure/auth/tokens.ts\n");

/***/ }),

/***/ "(rsc)/./src/lib/prisma.ts":
/*!***************************!*\
  !*** ./src/lib/prisma.ts ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var _prisma_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @prisma/client */ \"@prisma/client\");\n/* harmony import */ var _prisma_client__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_prisma_client__WEBPACK_IMPORTED_MODULE_0__);\n\nconst prisma = global.prisma ?? new _prisma_client__WEBPACK_IMPORTED_MODULE_0__.PrismaClient();\nif (true) {\n    global.prisma = prisma;\n}\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (prisma);\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9zcmMvbGliL3ByaXNtYS50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7QUFBOEM7QUFPOUMsTUFBTUMsU0FBU0MsT0FBT0QsTUFBTSxJQUFJLElBQUlELHdEQUFZQTtBQUVoRCxJQUFJRyxJQUF5QixFQUFjO0lBQ3pDRCxPQUFPRCxNQUFNLEdBQUdBO0FBQ2xCO0FBRUEsaUVBQWVBLE1BQU1BLEVBQUMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9zaWdvY2MtY29yZS8uL3NyYy9saWIvcHJpc21hLnRzPzAxZDciXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUHJpc21hQ2xpZW50IH0gZnJvbSAnQHByaXNtYS9jbGllbnQnO1xyXG5cclxuZGVjbGFyZSBnbG9iYWwge1xyXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby12YXJcclxuICB2YXIgcHJpc21hOiBQcmlzbWFDbGllbnQgfCB1bmRlZmluZWQ7XHJcbn1cclxuXHJcbmNvbnN0IHByaXNtYSA9IGdsb2JhbC5wcmlzbWEgPz8gbmV3IFByaXNtYUNsaWVudCgpO1xyXG5cclxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcclxuICBnbG9iYWwucHJpc21hID0gcHJpc21hO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBwcmlzbWE7XHJcblxyXG4iXSwibmFtZXMiOlsiUHJpc21hQ2xpZW50IiwicHJpc21hIiwiZ2xvYmFsIiwicHJvY2VzcyJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./src/lib/prisma.ts\n");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next","vendor-chunks/semver","vendor-chunks/jsonwebtoken","vendor-chunks/lodash.includes","vendor-chunks/jws","vendor-chunks/lodash.once","vendor-chunks/jwa","vendor-chunks/lodash.isinteger","vendor-chunks/ecdsa-sig-formatter","vendor-chunks/lodash.isplainobject","vendor-chunks/ms","vendor-chunks/lodash.isstring","vendor-chunks/lodash.isnumber","vendor-chunks/lodash.isboolean","vendor-chunks/safe-buffer","vendor-chunks/buffer-equal-constant-time"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fcatalogos%2Fjornadas%2Froute&page=%2Fapi%2Fcatalogos%2Fjornadas%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fcatalogos%2Fjornadas%2Froute.ts&appDir=D%3A%5CConstructora%5CConstructora_Camacon%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=D%3A%5CConstructora%5CConstructora_Camacon&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();