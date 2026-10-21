const MS365PermissionsGuide = () => (
  <section
    className="mt-4 rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-xs text-slate-700"
    aria-label="Orientações sobre permissões do Microsoft 365"
  >
    <h4 className="font-semibold text-blue-950">
      Permissão necessária no Microsoft Graph
    </h4>
    <p className="mt-1">
      Para consultar as licenças, adicione a permissão mínima abaixo:
    </p>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="rounded-md bg-white px-2 py-1 font-medium">Microsoft Graph</span>
      <span className="rounded-md bg-white px-2 py-1 font-medium">Permissões de aplicativo</span>
      <code className="rounded-md bg-blue-100 px-2 py-1 font-semibold text-blue-900">
        LicenseAssignment.Read.All
      </code>
    </div>
    <p className="mt-2">
      No Centro de administração do Microsoft Entra: Registros de aplicativo → selecione o app →
      Permissões de API → Adicionar uma permissão → Microsoft Graph → Permissões de aplicativo →
      <strong> LicenseAssignment.Read.All</strong> → <strong>Conceder consentimento do administrador</strong>.
    </p>
    <ul className="mt-2 space-y-1">
      <li><strong>Tenant ID:</strong> ID do diretório (tenant).</li>
      <li><strong>Client ID:</strong> ID do aplicativo.</li>
      <li><strong>Client Secret:</strong> copie o valor (Value) do segredo ao criá-lo; o ID do segredo não funciona.</li>
    </ul>
    <a
      className="mt-2 inline-block font-medium text-blue-700 underline hover:text-blue-900"
      href="https://learn.microsoft.com/graph/api/subscribedsku-list?view=graph-rest-1.0"
      target="_blank"
      rel="noreferrer"
    >
      Ver permissões oficiais para consultar licenças
    </a>
  </section>
);

export default MS365PermissionsGuide;
