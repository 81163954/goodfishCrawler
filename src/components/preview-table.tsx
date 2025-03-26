import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

const invoices = [
  {
    invoice: "INV001",
    paymentStatus: "Paid",
    totalAmount: "$250.00",
    paymentMethod: "Credit Card",
  },
  {
    invoice: "INV002",
    paymentStatus: "Pending",
    totalAmount: "$150.00",
    paymentMethod: "PayPal",
  },
  {
    invoice: "INV003",
    paymentStatus: "Unpaid",
    totalAmount: "$350.00",
    paymentMethod: "Bank Transfer",
  },
  {
    invoice: "INV004",
    paymentStatus: "Paid",
    totalAmount: "$450.00",
    paymentMethod: "Credit Card",
  },
  {
    invoice: "INV005",
    paymentStatus: "Paid",
    totalAmount: "$550.00",
    paymentMethod: "PayPal",
  },
  {
    invoice: "INV006",
    paymentStatus: "Pending",
    totalAmount: "$200.00",
    paymentMethod: "Bank Transfer",
  },
  {
    invoice: "INV007",
    paymentStatus: "Unpaid",
    totalAmount: "$300.00",
    paymentMethod: "Credit Card",
  },
];

export function PreviewTable({ previewData = [] }) {
  return (
    <div>
      {previewData && previewData.length != 0 ? (
        <Table>
          {/* <TableCaption>A list of your recent invoices.</TableCaption> */}
          <TableHeader>
            <TableRow>
              <TableHead>标题</TableHead>
              <TableHead>详情</TableHead>
              <TableHead>商品价格</TableHead>
              <TableHead>想要数</TableHead>
              <TableHead>浏览量</TableHead>
              <TableHead>店铺名称</TableHead>
              <TableHead>地区</TableHead>
              <TableHead>商品链接</TableHead>
              <TableHead>是否为推荐商品</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {previewData.map((item: any) => (
              <TableRow key={item.link}>
                <TableCell
                  title={item.title}
                  className="font-medium max-w-[150px] truncate"
                >
                  {item.title}
                </TableCell>
                <TableCell
                  title={item.detail}
                  className="font-medium max-w-[100px] truncate"
                >
                  {item.detail}
                </TableCell>
                <TableCell>{item.price}</TableCell>
                <TableCell>{item.wantCount}</TableCell>
                <TableCell>{item.viewCount}</TableCell>
                <TableCell>{item.shopName}</TableCell>
                <TableCell>{item.area}</TableCell>
                <TableCell>{item.link}</TableCell>
                <TableCell>{item.isRecommended ? "是" : "否"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {/* <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>Total</TableCell>
            <TableCell className="text-right">$2,500.00</TableCell>
          </TableRow>
        </TableFooter> */}
        </Table>
      ) : (
        "无数据，请先进行抓取"
      )}
    </div>
  );
}
