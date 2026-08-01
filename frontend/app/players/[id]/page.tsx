import CricketApp from "@/components/app/CricketApp"; export default async function Page({params}:{params:Promise<{id:string}>}){return <CricketApp page="profile" id={(await params).id}/>}
