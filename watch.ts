import chokidar from "chokidar";

console.log("开始监听...");

// 直接监听当前目录，便于测试
const watcher = chokidar.watch("./src", {
  persistent: true,
  ignoreInitial: true,
  ignored: /(^|[\/\\])\../, // 忽略隐藏文件
});

watcher
  .on("ready", () => {
    console.log("👀 初始化完成，开始监听文件变化...");
    console.log("请尝试修改任意文件来测试...");
  })
  .on("add", (path) => console.log(`文件被添加: ${path}`))
  .on("change", async (path) => {
    console.log(`文件被修改: ${path}`);
    await Bun.$`bun run build`;
  })
  .on("unlink", (path) => console.log(`文件被删除: ${path}`))
  .on("error", (error) => console.error(`错误: ${error}`));

// 保持进程运行
process.stdin.resume();
