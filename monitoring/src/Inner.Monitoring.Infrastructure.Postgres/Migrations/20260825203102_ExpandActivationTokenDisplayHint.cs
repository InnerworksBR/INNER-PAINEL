using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Inner.Monitoring.Infrastructure.Postgres.Migrations
{
    /// <inheritdoc />
    public partial class ExpandActivationTokenDisplayHint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "display_hint",
                schema: "monitoring",
                table: "activation_tokens",
                type: "character varying(255)",
                maxLength: 255,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "display_hint",
                schema: "monitoring",
                table: "activation_tokens",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(255)",
                oldMaxLength: 255);
        }
    }
}
