# Inner Monitoring Worker - Dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copiar arquivos de projeto
COPY ["src/Inner.Monitoring.Contracts/Inner.Monitoring.Contracts.csproj", "src/Inner.Monitoring.Contracts/"]
COPY ["src/Inner.Monitoring.Domain/Inner.Monitoring.Domain.csproj", "src/Inner.Monitoring.Domain/"]
COPY ["src/Inner.Monitoring.Infrastructure.Postgres/Inner.Monitoring.Infrastructure.Postgres.csproj", "src/Inner.Monitoring.Infrastructure.Postgres/"]
COPY ["src/Inner.Monitoring.Infrastructure/Inner.Monitoring.Infrastructure.csproj", "src/Inner.Monitoring.Infrastructure/"]
COPY ["src/Inner.Monitoring.Cloud.Api/Inner.Monitoring.Cloud.Api.csproj", "src/Inner.Monitoring.Cloud.Api/"]
COPY ["src/Inner.Monitoring.Cloud.Worker/Inner.Monitoring.Cloud.Worker.csproj", "src/Inner.Monitoring.Cloud.Worker/"]

# Restaurar dependências
RUN dotnet restore "src/Inner.Monitoring.Cloud.Worker/Inner.Monitoring.Cloud.Worker.csproj"

# Copiar código
COPY . .

# Build
WORKDIR "/src/src/Inner.Monitoring.Cloud.Worker"
RUN dotnet build "Inner.Monitoring.Cloud.Worker.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Inner.Monitoring.Cloud.Worker.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Usuário não-root para segurança
USER $APP_UID

ENTRYPOINT ["dotnet", "Inner.Monitoring.Cloud.Worker.dll"]
