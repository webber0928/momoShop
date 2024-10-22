const puppeteer = require('puppeteer');
const axios = require('axios');

const BASE_URL = 'https://www.momoshop.com.tw/search/searchShop.jsp?keyword=%E7%B1%83%E7%90%83%E9%9E%8B&cateLevel=0&_isFuzzy=0&searchType=2&attr=%7B%22%E5%B0%BA%E5%AF%B8%22%3A%5B%22US13%22%5D%7D&attrNo=%7B%22%E5%B0%BA%E5%AF%B8%22%3A%5B%22A0002G0018C0019%22%5D%7D&mAttL=%5B%22%E5%B0%BA%E5%AF%B8%22%5D&_advPriceS=0&_advPriceE=2000';

(async () => {
  // 啟動無頭瀏覽器
  const browser = await puppeteer.launch({
    // headless: false,  // 設置為 false 來啟動有頭模式
    // defaultViewport: null,  // 確保瀏覽器窗口不會被限制在默認大小
    // slowMo: 50  // 調慢操作速度，方便觀察每一步
  });
  
  const page = await browser.newPage();
  const resultObj = []
  
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    // 訪問當前頁面
    const url = `${BASE_URL}&curPage=${currentPage}`;
    await page.goto(url, {
      waitUntil: 'networkidle2',  // 確保頁面已經載入完成
    });

    // 抓取商品列表
    const products = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.listAreaLi'));
      return items.map(item => {
        const title = item.querySelector('.prdName') ? item.querySelector('.prdName').innerText : '';
        const link = item.querySelector('a.goods-img-url') ? item.querySelector('a.goods-img-url').href : '';
        const code = item.querySelector('a.insertWishList') ? item.querySelector('a.insertWishList').href : '';
        const goodsCodeMatch = code.match(/goodsCode:(\d+)/);
        const goodsCode = goodsCodeMatch ? goodsCodeMatch[1] : null;
        return {
          title: title,
          link: link,
          code: goodsCode,
        };
      });
    });

    // console.log(`第 ${currentPage} 頁抓取到的商品列表:`, products);
    console.log(`第 ${currentPage} 頁`);

    // 對每個商品發送 API 請求
    for (const product of products) {
      if (product.code) {
        try {
          const response = await axios.post(`https://www.momoshop.com.tw/api/moecapp/getGoodsSpecSplitInfo?domain=www`, {
            "goodsCode": product.code,
            "categoryCode": "",
            "simOrderYn": "0",
            "imgType": "webp",
            "fgDiscount": false,
            "hour": "",
            "sourcePage": "goodsPage",
            "entpCode": "",
            "addressData": {}
          });

          let isTarget = false;
          if (!response.data.rtnGoodsData.formData[2].goodsTypeInfo) continue;
          let typeList = response.data.rtnGoodsData.formData[2].goodsTypeInfo.map(x => {
            if (x.goodsType.indexOf('US13') > -1) isTarget = true;
            return x.goodsType;
          });

          let price = response.data.rtnGoodsData.formData[0].formContent.replace(',', '');
          if (isTarget) {
            resultObj.push({
              title: `${price}$ ${product.title}`,
              link: product.link,
              typeList: JSON.stringify(typeList)
            })
            // console.log(`價格: ${price}, URL: ${product.link} \n商品: ${product.title}, API 回應:`, typeList);
          }
        } catch (error) {
          console.error(`獲取 ${product.title} 的 API 數據時出錯:`, error);
        }
      }
    }

    // 檢查是否有下一頁
    const nextPageButton = await page.$('.page-next');
    hasNextPage = nextPageButton !== null;

    if (hasNextPage) {
      currentPage++;
    }
  }

  console.log(resultObj)

  // 關閉瀏覽器
  await browser.close();
})();