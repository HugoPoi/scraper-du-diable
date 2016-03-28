var cheerio = require('cheerio'),
request = require('request'),
iconv = require('iconv'),
url = require('url'),
_ = require('underscore'),
async = require('async'),
fs = require('fs'),
stringify = require('csv-stringify'),
csvParser = require('csv-parse'),
debug = require('debug')('webcrawler');

var FileCookieStore = require('tough-cookie-filestore');
// NOTE - currently the 'cookies.json' file must already exist!
var j = request.jar(new FileCookieStore('cookies.json'));
request = request.defaults({ jar : j })


function getProductsPages(urlCategorieList, callback){
  var productPageUrls = [];
  request({ url: urlCategorieList }, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var $ = cheerio.load(body);
      $('.cadre_produit a').each(function(){
        var href = $(this).attr('href');
        if(href){
          productPageUrls.push([url.resolve(urlCategorieList, href)]);
        }
      });
      callback(null,productPageUrls);
    }else{
      callback(error);
    }
  });
};


function getProductInfo(productUrl, callback){
  var productInfos = {};
  request({ url: productUrl, encoding: null }, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var ic = new iconv.Iconv('ISO-8859-1', 'UTF-8');
      body = ic.convert(body).toString();
      var $ = cheerio.load(body);
      productInfos.productName = $('#titre_produit').text().trim();
      productInfos.productPrice = $('.prixFiche').text().trim();
      productInfos.productCrossPrice = $('.prixBarreFiche').text().trim();
      productInfos.productRecon = $('.infos-origine').text().trim();
      $('.productspecs td:not(:only-child)').parent().each(function(){
        var key = $(this).children().first().text();
        var value = $(this).children().last().text();
        productInfos[key] = value;
      });
      callback(null,productInfos);
    }else{
      callback(error);
    }
  });
}

var mode = process.argv[2];

if(mode === 'cat'){
  debug('Search product on %s', process.argv[3]);
  getProductsPages(process.argv[3], function(err, productPageUrls){
    stringify(productPageUrls, function(err, csvdata){
      fs.writeFile('producturls.csv', csvdata, { flag: 'a' });
    });
  });
}


if(mode === 'product'){

  getProductInfo(process.argv[3], function(err, data){
    console.log(JSON.stringify(data));
  });

}


if(mode === 'getinfo'){

  csvParser(fs.readFileSync('producturls.csv'), function(err, products){
    async.mapLimit(products,5, function(item, done){
      getProductInfo(item[0], done);
      debug('Start getting %s', item[0]);
    }, function(err, products){
      var output = [];
      var keys = _.keys(products[0]);
      output.push(keys);
      products.forEach(function(item){
        var line  = [];
        keys.forEach(function(key){
          line.push(item[key]);
        });
        output.push(line);
      });
      stringify(output, function(err, csvdata){
        fs.writeFile('products.csv', csvdata, { flag: 'w' });
      });
    });
  });


}
