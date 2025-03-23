import { useState } from "react";
import { checkCurrentTab } from "./lib/utils";
import { PreviewTable } from "./components/preview-table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./components/ui/tooltip";

function App() {
  const [status, setStatus] = useState("");

  const [previewData, setPreviewData] = useState([]);

  const exportFile = async (items: any) => {
    try {
      setStatus("正在导出Excel...");
      const response = await chrome.runtime.sendMessage({
        action: "exportExcel",
        data: items,
        fileName: "商品数据集",
      });

      if (response.error) {
        throw new Error("导出失败: " + response.error);
      }
      setStatus("数据已导出！");
    } catch (error: any) {
      console.error("导出失败:", error);
      setStatus("导出失败: " + error.message);
    }
  };

  const quickCrawler = async () => {
    setStatus("快速抓取中...");

    try {
      const tab = await checkCurrentTab();

      const result: any = await chrome.scripting.executeScript({
        target: { tabId: tab.id as any },
        func: (async () => {
          async function sleep(ms: number) {
            return new Promise((resolve) => setTimeout(resolve, ms));
          }

          async function scrollToBottom() {
            const scrollHeight = document.documentElement.scrollHeight;
            window.scrollTo(0, scrollHeight);
            await sleep(1000);
          }

          async function getAllItems() {
            const items = new Set();
            let lastItemsCount = 0;
            let sameCountTimes = 0;

            const container = document.querySelector(
              '[class*="feeds-list-container"]'
            );
            if (!container) {
              return { error: "未找到商品列表" };
            }

            while (sameCountTimes < 3) {
              const cards = container.querySelectorAll(
                ".feeds-item-wrap--rGdH_KoF"
              );

              cards.forEach((card) => {
                if (!card.querySelector(".main-title--sMrtWSJa")) {
                  return;
                }

                const item = {
                  title:
                    card
                      .querySelector(".main-title--sMrtWSJa")
                      ?.textContent?.trim() || "",
                  price:
                    card
                      .querySelector(".price-wrap--YzmU5cUl")
                      ?.textContent?.trim() || "",
                  wantCount:
                    card
                      .querySelector('.text--MaM9Cmdn[title*="人想要"]')
                      ?.title?.replace(/[^0-9]/g, "") || "0",
                  link: card.href || "",
                  shopName:
                    card
                      .querySelector(".seller-text--Rr2Y3EbB")
                      ?.textContent?.trim() || "",
                };

                if (item.link) {
                  items.add(JSON.stringify(item));
                }
              });

              if (items.size === lastItemsCount) {
                sameCountTimes++;
              } else {
                sameCountTimes = 0;
                lastItemsCount = items.size;
              }

              await scrollToBottom();
            }

            const itemsArray = Array.from(items).map((item) =>
              JSON.parse(item)
            );
            return { items: itemsArray, total: itemsArray.length };
          }

          return getAllItems();
        }) as any,
      });

      if (result[0].result.error) {
        setStatus(result[0].result.error);
        return;
      }

      const { items, total } = result[0].result;
      if (total === 0) {
        setStatus("未找到商品数据");
        return;
      }

      // handleProgress({
      //   current: total,
      //   total,
      //   percentage: 100,
      //   message: "抓取完成！",
      // });
      setPreviewData(items);

      setStatus("抓取成功！");
    } catch (error: any) {
      console.error("抓取失败:", error);
      setStatus("抓取失败: " + error.message);
    }
  };

  const detailCrawler = async () => {
    setStatus("详情抓取中...");
    // progressBar.style.display = "block";
    // progressBar.value = 0;
    // progressBar.max = 100;
    // preview.style.display = "none";

    try {
      const tab = await checkCurrentTab();

      // 第一步：获取所有商品链接
      const linksResult: any = await chrome.scripting.executeScript({
        target: { tabId: tab.id as number },
        func: async () => {
          async function scrollToBottom() {
            return new Promise((resolve) => {
              const distance = 300;
              const delay = 800;
              let lastHeight = 0;
              let sameHeightCount = 0;
              const timer = setInterval(() => {
                window.scrollBy(0, distance);
                const currentHeight = document.documentElement.scrollHeight;
                if (currentHeight === lastHeight) {
                  sameHeightCount++;
                  if (sameHeightCount >= 3) {
                    clearInterval(timer);
                    setTimeout(resolve, 1500);
                  }
                } else {
                  sameHeightCount = 0;
                  lastHeight = currentHeight;
                }
              }, delay);
            });
          }

          async function getLinks() {
            await scrollToBottom();

            const container = document.querySelector(
              '[class*="feeds-list-container"]'
            );
            if (!container) return { error: "未找到商品列表" };

            const items: any = [];
            const cards = container.querySelectorAll(".cardWarp--dZodM57A");
            cards.forEach((card) => {
              const link = card.querySelector("a")?.href;
              const title =
                card
                  .querySelector(".main-title--sMrtWSJa")
                  ?.textContent?.trim() || "";
              if (link) {
                items.push({ title, link });
              }
            });

            return { items };
          }

          return await getLinks();
        },
      });

      if (linksResult[0].result.error) {
        throw new Error(linksResult[0].result.error);
      }

      const items = linksResult[0].result.items;
      const total = items.length;

      if (total === 0) {
        throw new Error("未找到商品链接");
      }

      // 第二步：依次访问每个商品详情页并抓取数据
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setStatus(`正在抓取第 ${i + 1}/${total} 个商品...`);
        console.log(1);
        const detailTab = await chrome.tabs.create({
          url: item.link,
          active: false,
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));

        console.log(2);

        const detailResult = await chrome.scripting.executeScript({
          target: { tabId: detailTab.id as number },
          func: () => {
            const statsContainer = document.querySelector(".want--ecByv3Sr");
            const statsElements = statsContainer?.querySelectorAll("div");
            const wantCount =
              statsElements?.[0]?.textContent?.match(/(\d+)人想要/)?.[1] || "0";
            const viewCount =
              statsElements?.[2]?.textContent?.replace(/[^0-9]/g, "") || "0";

            const detail = Array.from(
              document.querySelectorAll(".desc--GaIUKUQY span span")
            )
              .map((span) => span.textContent)
              .join(" ");

            return {
              price:
                document
                  .querySelector(".price--OEWLbcxC")
                  ?.textContent?.trim() || "",
              wantCount: wantCount,
              viewCount: viewCount,
              shopName:
                document
                  .querySelector(".item-user-info-nick--rtpDhkmQ")
                  ?.textContent?.trim() || "",
              link: window.location.href,
              isRecommended: false,
              title: detail,
            };
          },
        });

        console.log(3);

        await chrome.tabs.remove(detailTab.id as any);

        if (detailResult[0].result) {
          console.log("填充detail页面", items[i], detailResult[0].result);

          Object.assign(items[i], detailResult[0].result);
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      setPreviewData(items);

      setStatus("抓取成功！");
    } catch (error: any) {
      console.error("抓取失败:", error);
      setStatus("抓取失败: " + error.message);
    }
  };

  const detailAndRecommandCrawler = async () => {
    setStatus("详情+推荐抓取中...");

    try {
      const tab = await checkCurrentTab();

      // 第一步：获取所有商品链接
      const linksResult: any = await chrome.scripting.executeScript({
        target: { tabId: tab.id as number },
        func: async () => {
          async function sleep(ms: number) {
            return new Promise((resolve) => setTimeout(resolve, ms));
          }

          async function scrollToBottom() {
            const scrollHeight = document.documentElement.scrollHeight;
            window.scrollTo(0, scrollHeight);
            await sleep(1000);
          }

          async function getLinks() {
            const items = new Set();
            let lastItemsCount = 0;
            let sameCountTimes = 0;

            const container = document.querySelector(
              '[class*="feeds-list-container"]'
            );
            if (!container) return { error: "未找到商品列表" };

            while (sameCountTimes < 3) {
              const cards = container.querySelectorAll(".cardWarp--dZodM57A");

              cards.forEach((card) => {
                const link = card.querySelector("a")?.href;
                const title =
                  card
                    .querySelector(".main-title--sMrtWSJa")
                    ?.textContent?.trim() || "";
                if (link) {
                  items.add(JSON.stringify({ title, link }));
                }
              });

              if (items.size === lastItemsCount) {
                sameCountTimes++;
              } else {
                sameCountTimes = 0;
                lastItemsCount = items.size;
              }

              await scrollToBottom();
            }

            const itemsArray = Array.from(items).map((item) =>
              JSON.parse(item)
            );
            return { items: itemsArray };
          }

          return await getLinks();
        },
      });

      if (linksResult[0].result.error) {
        throw new Error(linksResult[0].result.error);
      }

      const items = linksResult[0].result.items;
      const total = items.length;

      if (total === 0) {
        throw new Error("未找到商品链接");
      }

      const allItems: any = [];

      // 第二步：依次访问每个商品详情页并抓取数据
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setStatus(`正在抓取第 ${i + 1}/${total} 个商品及其推荐商品...`);

        const detailTab = await chrome.tabs.create({
          url: item.link,
          active: false,
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const detailResult = await chrome.scripting.executeScript({
          target: { tabId: detailTab.id as any },
          func: async () => {
            async function sleep(ms: number) {
              return new Promise((resolve) => setTimeout(resolve, ms));
            }

            async function scrollToBottom() {
              const scrollHeight = document.documentElement.scrollHeight;
              window.scrollTo(0, scrollHeight);
              await sleep(1000);
            }

            // 获取当前商品详情
            const statsContainer = document.querySelector(".want--ecByv3Sr");
            const statsElements = statsContainer?.querySelectorAll("div");
            const wantCount =
              statsElements?.[0]?.textContent?.match(/(\d+)人想要/)?.[1] || "0";
            const viewCount =
              statsElements?.[2]?.textContent?.replace(/[^0-9]/g, "") || "0";

            const mainProduct = {
              price:
                document
                  .querySelector(".price--OEWLbcxC")
                  ?.textContent?.trim() || "",
              wantCount: wantCount,
              viewCount: viewCount,
              shopName:
                document
                  .querySelector(".item-user-info-nick--rtpDhkmQ")
                  ?.textContent?.trim() || "",
              link: window.location.href,
              isRecommended: false,
            };

            // 获取推荐商品
            const recommendedProducts = new Set();
            let lastRecommendedCount = 0;
            let sameCountTimes = 0;

            while (sameCountTimes < 3) {
              const recommendContainer = document.querySelector(
                '[class*="feeds-list-container"]'
              );
              if (recommendContainer) {
                const cards = recommendContainer.querySelectorAll(
                  ".feeds-item-wrap--rGdH_KoF"
                );
                cards.forEach((card) => {
                  if (!card.querySelector(".main-title--sMrtWSJa")) {
                    return;
                  }

                  const product = {
                    title:
                      card
                        .querySelector(".main-title--sMrtWSJa")
                        ?.textContent?.trim() || "",
                    price:
                      card
                        .querySelector(".price-wrap--YzmU5cUl")
                        ?.textContent?.trim() || "",
                    wantCount:
                      card
                        .querySelector('.text--MaM9Cmdn[title*="人想要"]')
                        ?.title?.replace(/[^0-9]/g, "") || "0",
                    viewCount: "0",
                    shopName:
                      card
                        .querySelector(".seller-text--Rr2Y3EbB")
                        ?.textContent?.trim() || "",
                    link: card.href || "",
                    isRecommended: true,
                  };

                  if (product.title && product.price) {
                    recommendedProducts.add(JSON.stringify(product));
                  }
                });

                if (recommendedProducts.size === lastRecommendedCount) {
                  sameCountTimes++;
                } else {
                  sameCountTimes = 0;
                  lastRecommendedCount = recommendedProducts.size;
                }

                await scrollToBottom();
              } else {
                break;
              }
            }

            const recommendedArray = Array.from(recommendedProducts).map(
              (item) => JSON.parse(item)
            );
            return {
              mainProduct,
              recommendedProducts: recommendedArray,
            };
          },
        });

        await chrome.tabs.remove(detailTab.id);

        if (detailResult[0].result) {
          const { mainProduct, recommendedProducts } = detailResult[0].result;
          mainProduct.title = item.title;
          allItems.push(mainProduct);
          allItems.push(...recommendedProducts);
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      setPreviewData(allItems);
    } catch (error: any) {
      console.error("抓取失败:", error);
      setStatus("抓取失败: " + error.message);
    }
  };

  return (
    <div className="p-6 w-[400px] flex flex-col gap-6">
      <div className="flex flex-row gap-2 items-center">
        <img
          className="w-10 h-10 rounded-full"
          src="./avatar.jpeg"
          alt="小柚同学"
        />
        <div className=" text-xl font-semibold">小柚闲鱼数据助手</div>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-2">
            <div className="text-base font-semibold">店铺页功能</div>
            <Tooltip>
              <TooltipTrigger asChild>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  className="lucide lucide-circle-help h-5 w-5 transition hover:text-indigo-500"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <path d="M12 17h.01" />
                </svg>
              </TooltipTrigger>
              <TooltipContent className="max-w-[400px] text-sm flex flex-col gap-2">
                <p className="text-base font-semibold">抓取说明</p>
                <p>
                  快速抓取：标题、商品、价格、想要数、浏览量、店铺名称、商品链接、是否为推荐商品。
                </p>
                <p>详情抓取：快速抓取的所有信息，标题改为详情全部内容</p>
                <p>详情+推荐抓取：额外抓取了详情页下方的部分推荐商品</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div
            className="text-indigo-500 transition hover:text-indigo-500/80 hover:underline cursor-pointer"
            onClick={() => {
              if (previewData && previewData.length != 0) {
                exportFile(previewData);
              } else {
                alert("没有可导出的数据，请先抓取数据！");
              }
            }}
          >
            导出数据
          </div>
        </div>
        <div className="text-indigo-500">{status}</div>
        <button onClick={quickCrawler}>快速抓取</button>
        <button onClick={detailCrawler}>详情抓取</button>
        <button onClick={detailAndRecommandCrawler}>详情+推荐抓取</button>
        {/* <button
          onClick={() => {
            console.log(previewData);
          }}
        >
          打印数据
        </button> */}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-row items-center justify-between">
          <div className="text-base font-semibold">数据预览</div>
          <div
            onClick={() => {
              setPreviewData([]);
            }}
            className="text-indigo-500 transition text-sm hover:text-indigo-500/80 hover:underline cursor-pointer"
          >
            清理数据
          </div>
        </div>
        <div className="border p-2 text-sm rounded-md w-full overflow-x-auto h-[200px]">
          <PreviewTable previewData={previewData} />
        </div>
      </div>
    </div>
  );
}

export default App;
