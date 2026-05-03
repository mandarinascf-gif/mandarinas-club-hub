document.addEventListener("DOMContentLoaded", async () => {
  const adminPage = window.MandarinasAdminPage;
  if (!adminPage) {
    return;
  }

  const access = await adminPage.requireAccess({
    pageTitle: "Busses standings",
  });

  if (!access.ok) {
    return;
  }

  if (!window.MandarinasSharedStandings?.init) {
    adminPage.renderGate({
      title: "Busses standings could not start",
      body: "The shared standings renderer failed to load for this page.",
    });
    return;
  }

  await window.MandarinasSharedStandings.init();
});
