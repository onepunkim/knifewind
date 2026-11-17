import Link from "next/link";
import { notFound } from "next/navigation";
import { getChampNames } from "@/lib/champions";
import { getMemberOverview, getMembersByIds, getSeasons } from "@/lib/queries";
import { MemberView } from "@/components/member-view";
import { SectionHead } from "@/components/ui";

export const metadata = { title: "회원 전적" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MemberPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  if (!UUID.test(params.id)) notFound();
  const members = await getMembersByIds([params.id]);
  const member = members.get(params.id);
  if (!member || member.status !== "approved") notFound();

  const [overview, seasons, names] = await Promise.all([getMemberOverview(params.id), getSeasons(), getChampNames()]);

  return (
    <main className="container">
      <SectionHead title={member!.chzzk_name}>
        <Link href="/hall-of-fame" className="small">← 명예의 전당</Link>
      </SectionHead>
      <MemberView overview={overview} seasons={seasons} names={names} />
    </main>
  );
}
