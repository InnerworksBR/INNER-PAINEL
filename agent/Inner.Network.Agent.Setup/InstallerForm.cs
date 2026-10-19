using System.Drawing;

namespace Inner.Network.Agent.Setup;

internal sealed class InstallerForm : Form
{
    private readonly Label _status = new();
    private readonly TextBox _code = new();
    private readonly Button _copy = new();
    private readonly Button _install = new();
    private bool _busy;

    public InstallerForm()
    {
        Text = "Instalar Agente Inner de Rede";
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(550, 300);
        Font = new Font("Segoe UI", 9F);
        FormClosing += (_, e) => e.Cancel = _busy;

        var title = new Label { AutoSize = true, Font = new Font("Segoe UI Semibold", 16F, FontStyle.Bold), Location = new Point(24, 20), Text = "Agente Inner de Rede" };
        var description = new Label { Location = new Point(26, 61), Size = new Size(498, 45), Text = "Instala o serviço de coleta SNMP neste Windows e solicita um código para vincular a instalação no Portal Inner." };
        _status.Location = new Point(26, 117);
        _status.Size = new Size(498, 42);
        _status.Text = "O instalador está pronto.";
        _status.ForeColor = Color.DimGray;

        var codeLabel = new Label { AutoSize = true, Location = new Point(26, 168), Text = "Código de vínculo" };
        _code.Location = new Point(26, 192);
        _code.Size = new Size(350, 27);
        _code.ReadOnly = true;
        _code.Font = new Font("Consolas", 16F, FontStyle.Bold);
        _code.TextAlign = HorizontalAlignment.Center;

        _copy.Location = new Point(388, 190);
        _copy.Size = new Size(136, 32);
        _copy.Text = "Copiar código";
        _copy.Enabled = false;
        _copy.Click += (_, _) => { if (!string.IsNullOrWhiteSpace(_code.Text)) Clipboard.SetText(_code.Text); };

        _install.Location = new Point(388, 244);
        _install.Size = new Size(136, 34);
        _install.Text = "Instalar";
        _install.Click += Install_Click;

        var footer = new Label { AutoSize = true, Location = new Point(26, 254), ForeColor = Color.DimGray, Text = "A instalação preserva a configuração e a fila local em atualizações." };
        Controls.AddRange([title, description, _status, codeLabel, _code, _copy, _install, footer]);
        AcceptButton = _install;
    }

    private async void Install_Click(object? sender, EventArgs e)
    {
        _busy = true;
        _install.Enabled = false;
        _copy.Enabled = false;
        _code.Clear();
        SetStatus("Preparando a instalação...");
        try
        {
            var result = await Task.Run(() => AgentInstaller.Install(UpdateStatus));
            _busy = false;
            if (result.PairingCode is { Length: > 0 } code)
            {
                _code.Text = code;
                _copy.Enabled = true;
                SetStatus($"Serviço instalado. Vincule o código no Portal Inner até {result.ExpiresAt:dd/MM/yyyy HH:mm} UTC.\r\n{result.VerificationUrl}");
                _status.ForeColor = Color.DarkGreen;
            }
            else if (result.State == "completed")
            {
                SetStatus("Agente já vinculado. A instalação foi atualizada sem alterar a identidade ou a fila.");
                _status.ForeColor = Color.DarkGreen;
            }
            else
            {
                SetStatus("Serviço instalado e aguardando internet. O agente emitirá o código quando conseguir acessar o Portal Inner.\r\nConsulte depois com network-agent-status.ps1.");
                _status.ForeColor = Color.DarkOrange;
            }
            _install.Text = "Concluir";
            _install.Enabled = true;
            _install.Click -= Install_Click;
            _install.Click += (_, _) => Close();
        }
        catch (Exception exception)
        {
            _busy = false;
            SetStatus("Não foi possível concluir a instalação.");
            _status.ForeColor = Color.DarkRed;
            _install.Enabled = true;
            MessageBox.Show(this, exception.Message, "Falha na instalação", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void UpdateStatus(string value) => BeginInvoke(new Action(() => SetStatus(value)));
    private void SetStatus(string value) => _status.Text = value;
}
