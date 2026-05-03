document.addEventListener("DOMContentLoaded", async () => {
  const adminPage = window.MandarinasAdminPage;
  if (!adminPage) {
    return;
  }

  await adminPage.requireAccess({
    pageTitle: "Busses setup",
  });
});
