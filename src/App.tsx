import { useState, useEffect } from "react";
import { checkCurrentTab } from "./lib/utils";
import { PreviewTable } from "./components/preview-table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./components/ui/tooltip";

import { Button } from "./components/ui/button";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Textarea } from "./components/ui/textarea";
import { useKeyValidation } from "./components/KeyValidationProvider";

function App() {
  const [status, setStatus] = useState("");

  const [previewData, setPreviewData] = useState([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordLimit, setKeywordLimit] = useState<number>(1);
  const [expiration, setExpiration] = useState<string | null>(null);

  const exportFile = async (items: any) => {
    console.log("exceldata", items);
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

  const searchCrawler = async ({ keywords, keywordLimit }: any) => {
    try {
      const allItems: any = [];
      setStatus("搜索抓取中...");

      // 遍历每个关键词
      for (let i = 0; i < keywords.length; i++) {
        const query = keywords[i];
        setStatus(`正在抓取第 ${i + 1}/${keywords.length} 个关键词: ${query}`);

        // 创建新标签页进行搜索
        const searchTab = await chrome.tabs.create({
          url: `https://www.goofish.com/search?q=${encodeURIComponent(query)}`,
          active: false,
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));

        //每个关键词下所有商品
        let allItemsByKeyword: any[] = [];
        for (let i = 0; i < keywordLimit; i++) {
          // 执行抓取脚本
          const result: any = await chrome.scripting.executeScript({
            target: { tabId: searchTab.id as number },
            func: async (limit: number) => {
              async function sleep(ms: number) {
                return new Promise((resolve) => setTimeout(resolve, ms));
              }

              async function scrollToBottom() {
                const scrollHeight = document.documentElement.scrollHeight;
                window.scrollTo(0, scrollHeight);
                await sleep(1000);
              }

              const items = new Set();
              let lastItemsCount = 0;
              let sameCountTimes = 0;

              while (sameCountTimes < 3 && items.size < limit) {
                const container = document.querySelector(
                  '[class*="feeds-list-container"]'
                );
                if (!container) return { error: "未找到商品列表" };

                const cards = container.querySelectorAll(
                  ".feeds-item-wrap--rGdH_KoF"
                );

                cards.forEach((card) => {
                  if (!card.querySelector(".main-title--sMrtWSJa")) return;

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
                    link: (card as HTMLAnchorElement).href || "",
                    shopName: "",
                    area:
                      card
                        .querySelector(".seller-text--Rr2Y3EbB")
                        ?.textContent?.trim() || "",
                    keyword:
                      document.querySelector(".search-input--WY2l9QD3")
                        ?.value || "",
                  };

                  if (item.title && item.price) {
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
              return { items: itemsArray.slice(0, limit) };
            },
            args: [30],
          });

          if (result[0].result.error) {
            throw new Error(result[0].result.error);
          }

          console.log("result", ...result[0].result.items);

          allItemsByKeyword = [...allItemsByKeyword, ...result[0].result.items];

          // const nextPageButton = document.querySelector(
          //   ".search-pagination-arrow-container--lt2kCP6J"
          // ) as HTMLElement;
          // console.log("nextPageButton", nextPageButton);

          const jumpToNextPage: any = await chrome.scripting.executeScript({
            target: { tabId: searchTab.id as number },
            func: async () => {
              // 等待页面加载
              await new Promise((resolve) => setTimeout(resolve, 2000));

              const nextPageButton = document.querySelectorAll(
                ".search-page-tiny-arrow-container--tVZE99sy"
              )[1] as HTMLElement;

              if (nextPageButton) {
                nextPageButton.click(); // 点击下一页
                await new Promise((resolve) => setTimeout(resolve, 2000)); // 等待页面加载
                return true;
              } else {
                return false;
              }
            },
          });

          if (!jumpToNextPage[0].result) {
            console.log("暂停，无下一页");
            break;
          } else {
            console.log("下一页");
          }
        }

        // 关闭搜索标签页
        await chrome.tabs.remove(searchTab.id as number);

        allItems.push(...allItemsByKeyword);

        // 每个关键词之间暂停1秒
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log("allItems", allItems);

      setPreviewData(allItems);
      setStatus("抓取完成！");
    } catch (error: any) {
      console.error("抓取失败:", error);
      setStatus("抓取失败: " + error.message);
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
          func: async () => {
            const statsContainer = document.querySelector(".want--ecByv3Sr");
            const statsElements = statsContainer?.querySelectorAll("div");
            const wantCount =
              statsElements?.[0]?.textContent?.match(/(\d+)人想要/)?.[1] || "0";
            const viewCount =
              statsElements?.[2]?.textContent?.replace(/[^0-9]/g, "") || "0";

            const detail = await (async () => {
              let detail = "";
              // 点击展开详情
              const expandButton = document.querySelector(
                ".show--iRoAB8Sq"
              ) as HTMLElement;
              if (expandButton) {
                expandButton.click(); // 点击展开
                await new Promise((resolve) => setTimeout(resolve, 1000)); // 等待展开动画完成
                detail = document.querySelector(".desc--GaIUKUQY")?.innerText;
              } else {
                if (
                  document.querySelectorAll(".desc--GaIUKUQY span span")
                    .length == 0
                ) {
                  detail =
                    document.querySelector(".desc--GaIUKUQY")?.innerHTML || "";
                } else {
                  detail = Array.from(
                    document.querySelectorAll(".desc--GaIUKUQY span span")
                  )
                    .map((span) => span.textContent)
                    .join(" ");
                }
              }
              return detail;
            })();

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
              detail: detail,
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
            const detail = await (async () => {
              let detail = "";
              // 点击展开详情
              const expandButton = document.querySelector(
                ".show--iRoAB8Sq"
              ) as HTMLElement;
              if (expandButton) {
                expandButton.click(); // 点击展开
                await new Promise((resolve) => setTimeout(resolve, 1000)); // 等待展开动画完成
                detail = document.querySelector(".desc--GaIUKUQY")?.innerText;
              } else {
                if (
                  document.querySelectorAll(".desc--GaIUKUQY span span")
                    .length == 0
                ) {
                  detail =
                    document.querySelector(".desc--GaIUKUQY")?.innerHTML || "";
                } else {
                  detail = Array.from(
                    document.querySelectorAll(".desc--GaIUKUQY span span")
                  )
                    .map((span) => span.textContent)
                    .join(" ");
                }
              }
              return detail;
            })();

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
              detail: detail,
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

  const searchDetailCrawler = async ({ keywords, keywordLimit }: any) => {
    try {
      const allItems: any = [];
      setStatus("搜索详情抓取中...");

      // 遍历每个关键词
      for (let i = 0; i < keywords.length; i++) {
        const query = keywords[i];
        setStatus(`正在抓取第 ${i + 1}/${keywords.length} 个关键词: ${query}`);

        // 创建新标签页进行搜索
        const searchTab = await chrome.tabs.create({
          url: `https://www.goofish.com/search?q=${encodeURIComponent(query)}`,
          active: false,
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));

        let allPageItems: string | any[] = [];

        for (let i = 0; i < keywordLimit; i++) {
          // 执行搜索页抓取脚本获取商品链接
          const linksResult: any = await chrome.scripting.executeScript({
            target: { tabId: searchTab.id as number },
            func: async (limit: number) => {
              async function sleep(ms: number) {
                return new Promise((resolve) => setTimeout(resolve, ms));
              }

              async function scrollToBottom() {
                const scrollHeight = document.documentElement.scrollHeight;
                window.scrollTo(0, scrollHeight);
                await sleep(1000);
              }

              const items = new Set();
              let lastItemsCount = 0;
              let sameCountTimes = 0;

              while (sameCountTimes < 3 && items.size < limit) {
                const container = document.querySelector(
                  '[class*="feeds-list-container"]'
                );
                if (!container) return { error: "未找到商品列表" };

                const cards = container.querySelectorAll(
                  ".feeds-item-wrap--rGdH_KoF"
                );

                cards.forEach((card) => {
                  const link = (card as HTMLAnchorElement).href;
                  const title =
                    card
                      .querySelector(".main-title--sMrtWSJa")
                      ?.textContent?.trim() || "";
                  if (link && title) {
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
              return { items: itemsArray.slice(0, limit) };
            },
            args: [30],
          });

          if (linksResult[0].result.error) {
            throw new Error(linksResult[0].result.error);
          }
          allPageItems = [...allPageItems, ...linksResult[0].result.items];

          const jumpToNextPage: any = await chrome.scripting.executeScript({
            target: { tabId: searchTab.id as number },
            func: async () => {
              // 等待页面加载
              await new Promise((resolve) => setTimeout(resolve, 2000));

              const nextPageButton = document.querySelectorAll(
                ".search-page-tiny-arrow-container--tVZE99sy"
              )[1] as HTMLElement;

              if (nextPageButton) {
                nextPageButton.click(); // 点击下一页
                await new Promise((resolve) => setTimeout(resolve, 2000)); // 等待页面加载
                return true;
              } else {
                return false;
              }
            },
          });

          if (!jumpToNextPage[0].result) {
            console.log("暂停，无下一页");
            break;
          } else {
            console.log("下一页");
          }
        }

        await chrome.tabs.remove(searchTab.id as number);

        // if (linksResult[0].result.error) {
        //   throw new Error(linksResult[0].result.error);
        // }

        // const items = linksResult[0].result.items;
        // const total = items.length;

        // if (total === 0) {
        //   throw new Error("未找到商品链接");
        // }

        const total = allPageItems.length;
        if (total === 0) {
          throw new Error("未找到商品链接");
        }

        // 第二步：依次访问每个商品详情页并抓取数据
        for (let j = 0; j < allPageItems.length; j++) {
          const item = allPageItems[j];
          setStatus(
            `关键词 ${i + 1}/${keywords.length}: 正在抓取第 ${j + 1}/${
              allPageItems.length
            } 个商品详情...`
          );

          const detailTab = await chrome.tabs.create({
            url: item.link,
            active: false,
          });
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const detailResult = await chrome.scripting.executeScript({
            target: { tabId: detailTab.id as number },
            func: async () => {
              const statsContainer = document.querySelector(".want--ecByv3Sr");
              const statsElements = statsContainer?.querySelectorAll("div");
              const wantCount =
                statsElements?.[0]?.textContent?.match(/(\d+)人想要/)?.[1] ||
                "0";
              const viewCount =
                statsElements?.[2]?.textContent?.replace(/[^0-9]/g, "") || "0";

              const detail = await (async () => {
                let detail = "";
                // 点击展开详情
                const expandButton = document.querySelector(
                  ".show--iRoAB8Sq"
                ) as HTMLElement;
                if (expandButton) {
                  expandButton.click(); // 点击展开
                  await new Promise((resolve) => setTimeout(resolve, 1000)); // 等待展开动画完成
                  detail = document.querySelector(".desc--GaIUKUQY")?.innerText;
                } else {
                  if (
                    document.querySelectorAll(".desc--GaIUKUQY span span")
                      .length == 0
                  ) {
                    detail =
                      document.querySelector(".desc--GaIUKUQY")?.innerHTML ||
                      "";
                  } else {
                    detail = Array.from(
                      document.querySelectorAll(".desc--GaIUKUQY span span")
                    )
                      .map((span) => span.textContent)
                      .join(" ");
                  }
                }
                return detail;
              })();

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
                area:
                  document
                    .querySelector(".seller-text--Rr2Y3EbB")
                    ?.textContent?.trim() || "",
                link: window.location.href,
                detail: detail,
                keyword:
                  document.querySelector(".search-input--WY2l9QD3")?.value ||
                  "",
              };
            },
          });

          await chrome.tabs.remove(detailTab.id as number);

          if (detailResult[0].result) {
            const detailData = detailResult[0].result;
            detailData.title = item.title;
            allItems.push(detailData);
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      setPreviewData(allItems);
      setStatus("抓取完成！");
    } catch (error: any) {
      console.error("抓取失败:", error);
      setStatus("抓取失败: " + error.message);
    }
  };
  const { key, setIsValid } = useKeyValidation() as any;

  useEffect(() => {
    //首先从远端查询过期时间，如果远程失败，在用本地过期时间
    (async () => {
      try {
        const statusResponse = await fetch(
          "http://124.222.146.206:3000/api/queryKeyStatus",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ key: key }),
          }
        );

        // 确保请求成功
        if (!statusResponse.ok) {
          throw new Error(`HTTP error! status: ${statusResponse.status}`);
        }

        const statusData = await statusResponse.json();
        // 判断过期时间
        const currentTime = new Date();
        const usedAt = new Date(statusData.usedAt);
        console.log(1);

        if (new Date(usedAt.setMonth(usedAt.getMonth() + 1)) < currentTime) {
          console.log(2, usedAt, currentTime);
          //过期
          chrome.storage.local.set(
            { validSuccess: false, key: null },
            () => {}
          );
          setIsValid(false);
        } else {
          console.log(3);
          //没过期
          setExpiration(usedAt.toISOString());
        }
      } catch (error) {
        console.log(4);
        //如果网络失败，使用本地的判断
        chrome.storage.local.get("expiration", (result) => {
          if (result.expiration) {
            const currentTime = new Date();
            const storedExpiration = new Date(result.expiration);

            if (storedExpiration > currentTime) {
              console.log(5, "使用本地存储的过期时间:", result.expiration);
              setExpiration(result.expiration);
            } else {
              // console.log(6, "本地存储的过期时间已过期");
              // chrome.storage.local.set(
              //   { validSuccess: false, key: null },
              //   () => {}
              // );
              // setIsValid(false);
            }
          } else {
            console.log(7, "本地没有存储的过期时间，默认认为过期");
            chrome.storage.local.set(
              { validSuccess: false, key: null },
              () => {}
            );
            setIsValid(false);
          }
        });
      }
    })();
  }, []);

  return (
    <div className="p-6 w-[400px] flex flex-col gap-4 self-start">
      {/* header */}
      <div className="flex flex-row gap-2 items-center">
        <img
          className="w-10 h-10 rounded-full"
          src="./avatar.jpeg"
          alt="小柚同学"
        />
        <div className=" text-xl font-semibold">小柚闲鱼数据助手</div>
      </div>
      {/* authinfo */}
      <div className="flex flex-col font-semibold gap-2 border-indigo-400 p-4 rounded-md border-2 ">
        <div>{"卡密ID:  " + key}</div>
        <div>
          {"过期时间:  "}
          {expiration ? new Date(expiration).toLocaleString() : "未设置"}
        </div>
      </div>

      {/* tab */}
      <Tabs defaultValue="shop">
        <TabsList className="grid w-full grid-cols-2 gap-1">
          <TabsTrigger className="data-[state=active]:bg-black" value="shop">
            店铺页
          </TabsTrigger>
          <TabsTrigger className="data-[state=active]:bg-black" value="search">
            搜索页
          </TabsTrigger>
        </TabsList>
        <TabsContent asChild value="shop">
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
                  <TooltipContent
                    side="bottom"
                    className="max-w-[400px] text-sm flex flex-col gap-2"
                  >
                    <p className="text-base font-semibold">抓取说明</p>
                    <p>
                      快速抓取：标题、商品、价格、想要数、店铺名称、商品链接。
                    </p>
                    <p>详情抓取：快速抓取的所有信息+浏览量，标题改为详情内容</p>
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
          </div>
        </TabsContent>
        <TabsContent asChild value="search">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex flex-row items-center justify-between">
              <div className="flex flex-row items-center gap-2">
                <div className="text-base font-semibold">搜索页功能</div>
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
                  <TooltipContent
                    side="bottom"
                    className="max-w-[400px] text-sm flex flex-col gap-2"
                  >
                    <p className="text-base font-semibold">抓取说明</p>
                    <p>
                      搜索抓取：根据关键词列表，最多5个，依次进行抓取，可设定每个关键词抓取页数。
                    </p>
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

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex flex-row gap-[2px]">
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
                    className="lucide lucide-settings"
                  >
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  搜索设置
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none text-base">
                      搜索设置
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      配置搜索时的关键词列表，关键词抓取页数
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex flex-col items-start gap-2 text-sm">
                      <Label htmlFor="width">
                        关键词列表（每行识别为一个关键词）
                      </Label>
                      <Textarea
                        className="max-h-[120px]"
                        rows={5}
                        value={keywords.join("\n")}
                        onChange={(e) => {
                          const newKeywords = e.target.value.split("\n");
                          setKeywords(newKeywords);
                        }}
                      />
                    </div>
                    <div className="flex flex-col items-start gap-2">
                      <Label htmlFor="width">每个关键词抓取页数</Label>
                      <Input
                        type="number"
                        id="width"
                        value={keywordLimit}
                        onChange={(e) =>
                          setKeywordLimit(Number(e.target.value))
                        }
                        className="h-8"
                      />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <button
              onClick={() => {
                const filterKeywords = keywords.filter((k) => k != "");
                if (filterKeywords.length <= 0) {
                  alert("请先填写关键词");
                  return;
                }

                if (keywordLimit <= 0) {
                  alert("关键词抓取页数应该大于0");
                  return;
                }

                searchCrawler({
                  keywordLimit: keywordLimit,
                  keywords: filterKeywords,
                });
              }}
            >
              快速抓取
            </button>

            <button
              onClick={() => {
                const filterKeywords = keywords.filter((k) => k != "");
                if (filterKeywords.length <= 0) {
                  alert("请先填写关键词");
                  return;
                }

                if (keywordLimit <= 0) {
                  alert("关键词抓取页数应该大于0");
                  return;
                }

                searchDetailCrawler({
                  keywordLimit: keywordLimit,
                  keywords: filterKeywords,
                });
              }}
            >
              详情抓取
            </button>
          </div>
        </TabsContent>
      </Tabs>
      {/* data */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-row gap-2 items-center">
            <div className="text-base font-semibold">数据预览</div>
            <div>当前有{previewData.length}条数据</div>
          </div>
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
