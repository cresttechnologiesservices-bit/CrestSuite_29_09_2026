// import { Routes, Route, Navigate } from "react-router-dom";
// import { useQuery } from "@tanstack/react-query";
// import { api } from "../api/client";
// import { ProjectsList } from "../components/projects/ProjectsList";
// import { ProjectDetail } from "../components/projects/ProjectDetail";

// export function Projects() {
//   // I1: Projects is a management surface — plain MEMBERs are redirected away
//   // (the nav item is also hidden server-side, and the API rejects mutations).
//   const { data: user, isLoading } = useQuery({
//     queryKey: ["user-profile"],
//     queryFn: async () => (await api.get("/users/me")).data,
//   });

//   if (isLoading) {
//     return <div className="p-6 text-slate-500">Loading...</div>;
//   }
//   if (user && user.role === "MEMBER") {
//     return <Navigate to="/tracker" replace />;
//   }

//   return (
//     <Routes>
//       <Route index element={<ProjectsList />} />
//       <Route path=":projectId" element={<ProjectDetail />} />
//     </Routes>
//   );
// }

import { Routes, Route, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { ProjectsList } from "../components/projects/ProjectsList";
import { ProjectDetail } from "../components/projects/ProjectDetail";

export function Projects() {
  // I1: Projects is a management surface — plain MEMBERs are redirected away
  // (the nav item is also hidden server-side, and the API rejects mutations).
  const { data: user, isLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => (await api.get("/users/me")).data,
  });

  // A plain MEMBER who was made a project manager still needs this page
  const { data: mine, isLoading: mineLoading } = useQuery({
    queryKey: ["my-managed-projects", user?.id],
    enabled: !!user && user.role === "MEMBER",
    queryFn: async () => (await api.get("/projects", { params: { page_size: 200 } })).data,
  });
  const managesProject = !!mine?.items?.some((p: any) =>
    p.members?.some((m: any) => m.userId === user?.id && m.role === "manager")
  );

  if (isLoading || (user?.role === "MEMBER" && mineLoading)) {
    return <div className="p-6 text-slate-500">Loading...</div>;
  }
  if (user && user.role === "MEMBER" && !managesProject) {
    return <Navigate to="/tracker" replace />;
  }

  return (
    <Routes>
      <Route index element={<ProjectsList />} />
      <Route path=":projectId" element={<ProjectDetail />} />
    </Routes>
  );
}
