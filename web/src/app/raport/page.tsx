import { redirect } from "next/navigation";

// old address: the report is now split into /pulpit, /dni and /prompty
export default function ReportPage() {
  redirect("/pulpit");
}
