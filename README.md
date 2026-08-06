# 订单 LBS 点位工具

基于 Vue 3 + TypeScript + Vite + Element Plus + Less，使用高德地图瓦片（与 `kys-therapist-map` 相同方式）在地图上标注订单相关点位。

## 功能

- 全屏高德地图底图
- 右上角「导入订单点位」打开弹框，粘贴订单 JSON（不限长度）
- 确定后标记三个点位：
  - 技师位置：`technicianLatitude` / `technicianLongitude`
  - 客户位置：`customerLatitude` / `customerLongitude`
  - 服务场所：`address.lat` / `address.lng`

## 本地运行

双击根目录 `start.bat` 即可（会自动安装依赖、启动服务并打开浏览器；关闭窗口即停止）。

也可手动：

```bash
npm install
npm run dev
```

访问：http://127.0.0.1:18805/

## GitHub Pages

当前用 **分支部署**（不依赖 Actions；账号计费恢复后可改回 Actions 自动远程打包）。

1. 仓库 Settings → Pages → Source：选 **Deploy from a branch**
2. Branch：`main`，目录：`/docs`
3. 访问：https://aithena.github.io/kys-order-lbs/

更新站点时本地执行：

```bash
npm run build:docs
git add docs
git commit -m "Update GitHub Pages docs build"
git push
```

### 测试数据

```JSON
{"way":0,"soure":1,"merchantId":4,"merchantName":"康医手科技 （用于测试）","technicianId":1,"technicianName":"唐梦玲","technicianPhone":"15874180949","technicianLatitude":28.217548844633633,"technicianLongitude":113.09970706701279,"customerLatitude":28.212,"customerLongitude":113.091,"arrivalTime":"2026-08-06 10:30:00","buyMessage":"允许电联","homeMode":0,"outLetId":0,"scene":2,"soureId":"1","sourceCategory":1,"soureDetail":"{\"techId\":1,\"type\":\"ecard\",\"pageName\":\"名片详情\"}","schoolId":2,"schoolName":"柳奕反射疗法","goodss":[{"goodsType":0,"goodsId":121,"goodsTitle":"测试项目","goodsGroupId":40,"goodsGroupName":"非遗推拿","cover":"https://kys-cdn.kangyishou.com/prod/kys-platform/2026/03/13/74330e5dc813f7aa4f6ab357040103e6.png","duration":30,"fee":1,"dashFee":0,"quantity":1}],"tripFee":0,"address":{"customerAddressId":30019,"fullName":"唐女士","phone":"15874180949","province":430000,"city":430100,"district":430121,"regionName":"湖南省长沙市长沙县","address":"盼盼路28号星沙希尔顿欢朋酒店一楼 皇牛潮汕牛肉火锅(长沙店)","lat":28.227687,"lng":113.09939,"distance":0.1}}

```