import esbuild from "esbuild";

const mode = process.argv[2];
if (mode === "test") {
  await esbuild.build({ entryPoints: ["src/core.ts"], outfile: ".test-build/core.mjs", bundle: true, platform: "node", format: "esm", target: "es2018" });
} else {
  const options = {
    entryPoints: ["src/main.ts"],
    outfile: "main.js",
    bundle: true,
    platform: "browser",
    format: "cjs",
    target: "es2018",
    external: ["obsidian"],
    sourcemap: mode === "production" ? false : "inline",
    minify: false,
    banner: { js: "/* Idraaak Arabic List Fixer | MIT | https://idraaak.com/ */" }
  };
  if (mode === "production") await esbuild.build(options);
  else await (await esbuild.context(options)).watch();
}
