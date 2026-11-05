const http = require('node:http');
const product = {id:10,storeId:2,title:'Порция 200 г — длинное название фирменного блюда для проверки переноса',price:47.8,quantityStep:200,measurementUnit:'gram',measurementUnitLabel:'г',stockQuantity:10000,availableFrom:'10:00',images:[],supplements:[]};
const category = {id:1,slug:'food',name:'Продукты',isLeaf:true};
const group = {id:1,slug:'firmennye-bliuda',title:'Фирменные блюда',is_recommended:true,productsCount:1};
http.createServer((req,res) => {
  const u = new URL(req.url,'http://local');
  let data = [];
  let status = 200;
  if (/\/products\/\d+$/.test(u.pathname)) { const id=Number(u.pathname.split('/').pop()); data = id>=10&&id<=33 ? {...product,id} : {message:'Товар не найден'}; if (id<10||id>33) status = 404; }
  else if (u.pathname.includes('/products')) data = u.searchParams.has('query') ? Array.from({length:24},(_,i)=>({...product,id:10+i})) : [product];
  else if (u.pathname.endsWith('/search/suggestions')) data = [{id:10,title:product.title,type:'product'}];
  else if (u.pathname.endsWith('/banners')) data = [
    {id:1,title:'Недоступная акция',image:{path:'/shop/brand-icon-192-v2.png'},linkType:'product',linkProductId:3244},
    {id:2,title:'Акция магазина',image:{path:'/shop/brand-icon-192-v2.png'},linkType:'product',linkProductId:10},
  ];
  else if (u.pathname.endsWith('/stores/2')) data = {id:2,name:'Ласточка',address:'Тестовый магазин',isActive:true,isPickupEnabled:true};
  else if (u.pathname.endsWith('/stores')) data = [{id:2,name:'Ласточка',address:'Тестовый магазин',isActive:true,isPickupEnabled:true}];
  else if (/\/categories\/[^/]+$/.test(u.pathname)) data = category;
  else if (u.pathname.includes('/categories')) data = [category];
  else if (/\/product-groups\/[^/]+$/.test(u.pathname)) data = group;
  else if (u.pathname.includes('/product-groups')) data = [group];
  else if (u.pathname.endsWith('/app-settings')) data = {checkoutWithoutSlots:false};
  setTimeout(() => {res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify({data,hasMore:false}));}, /\/products\/31\/(similar|related)$/.test(u.pathname) ? 800 : 100);
}).listen(4010,'127.0.0.1');
