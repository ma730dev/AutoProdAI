#define MyAppName "AutoProd Motor Local"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "AutoProd AI"
#define MyAppURL "https://autoprod.io"
#define MyAppExeName "autoprod-motor.exe"

[Setup]
AppId={{D649A327-048F-4DF9-9159-8802E29FE41B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\AutoProdAI
DisableDirPage=no
DisableProgramGroupPage=yes
OutputBaseFilename=AutoProd-Setup
OutputDir=..\..\..\dist
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "..\..\..\dist\autoprod-motor.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\..\bin\*"; DestDir: "{app}\bin"; Flags: ignoreversion recursesubdirs createallsubdirs

[Dirs]
Name: "{app}\bin"
Name: "{app}\workspace"
Name: "{app}\workspace\youtube"
Name: "{app}\workspace\youtube\Canal_1"
Name: "{app}\workspace\youtube\Canal_1\InfoCanal"
Name: "{app}\workspace\youtube\Canal_1\Guiones"
Name: "{app}\workspace\youtube\Canal_1\Videos"
Name: "{app}\workspace\youtube\Canal_1\Miniatura"
Name: "{app}\workspace\youtube\Canal_1\Musica"
Name: "{app}\workspace\youtube\Canal_1\Imagenes"

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\AutoProd Motor"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigFile: String;
  ConfigContent: String;
  AppPath: String;
  WorkspacePath: String;
  BinPath: String;
  CanalPath: String;
begin
  if CurStep = ssPostInstall then
  begin
    AppPath := ExpandConstant('{app}');
    ConfigFile := AppPath + '\.autoprod-config.json';
    WorkspacePath := AppPath + '\workspace\youtube';
    BinPath := AppPath + '\bin';
    CanalPath := AppPath + '\workspace\youtube\Canal_1';
    
    // Plantillas de recursos iniciales
    SaveStringToFile(CanalPath + '\InfoCanal\Contexto_canal.md',
      '# Contexto y ADN del Canal: Canal_1' + #13#10#13#10 +
      '## 🎯 Nicho y Audiencia Objetivo' + #13#10 +
      '- **Temática / Nicho:** Temática Principal del Canal' + #13#10 +
      '- **Público Objetivo:** Creadores y entusiastas del nicho' + #13#10 +
      '- **Tono de Voz:** Cercano, profesional y dinámico' + #13#10#13#10 +
      '## 📋 Directivas de Producción y Marca' + #13#10 +
      '- **Estilo visual:** Moderno, limpio y minimalista' + #13#10 +
      '- **Duración promedio:** 8 - 15 minutos' + #13#10 +
      '- **Frecuencia:** Semanal' + #13#10, False);

    SaveStringToFile(CanalPath + '\InfoCanal\Metricas_canal.md',
      '# Métricas y Rendimiento del Canal: Canal_1' + #13#10#13#10 +
      '| Fecha | Video | Vistas | CTR Miniatura | Retención Media |' + #13#10 +
      '|---|---|---|---|---|' + #13#10 +
      '| Registro | Video 1 (Base) | - | - | - |' + #13#10, False);

    SaveStringToFile(CanalPath + '\InfoCanal\Historial_canal.md',
      '# Historial de Contenido y Banco de Ideas: Canal_1' + #13#10#13#10 +
      '## 📌 Temas Cubiertos' + #13#10 +
      '- [x] Apertura e inicialización del canal Canal_1' + #13#10#13#10 +
      '## 💡 Banco de Ideas Futuras' + #13#10 +
      '- Idea 1: Introducción a la temática y fundamentos clave' + #13#10 +
      '- Idea 2: Guía práctica paso a paso para creadores' + #13#10 +
      '- Idea 3: Análisis de tendencias y errores comunes' + #13#10, False);

    SaveStringToFile(CanalPath + '\Guiones\Plantilla_Guion.md',
      '# Guion: [Título del Video para Canal_1]' + #13#10#13#10 +
      '## 🎣 Gancho Inicial (0:00 - 0:30)' + #13#10 +
      '- Planteamiento del problema y por qué este contenido es indispensable.' + #13#10#13#10 +
      '## 📖 Desarrollo Principal (0:30 - 7:00)' + #13#10 +
      '- Punto 1: Concepto clave y contexto' + #13#10 +
      '- Punto 2: Demostración práctica y desglose de valor' + #13#10 +
      '- Punto 3: Conclusión accionable' + #13#10#13#10 +
      '## 🚀 Llamado a la Acción y Cierre (7:00 - 8:00)' + #13#10 +
      '- Pregunta para interacción en comentarios y cierre de video.' + #13#10, False);

    SaveStringToFile(CanalPath + '\Videos\README.md',
      '# Videos y Clips (Canal_1)' + #13#10 +
      'Almacenamiento de metraje bruto, grabaciones y exportaciones finales.' + #13#10, False);

    SaveStringToFile(CanalPath + '\Miniatura\Ideas_Miniaturas.md',
      '# Conceptos de Miniaturas: Canal_1' + #13#10#13#10 +
      '- **Concepto 1:** Expresión de alto impacto con elemento central de contraste.' + #13#10 +
      '- **Tipografía:** Máximo 3 palabras grandes y legibles en dispositivos móviles.' + #13#10 +
      '- **Colores:** Tonos vibrantes sobre fondo oscuro.' + #13#10, False);

    SaveStringToFile(CanalPath + '\Musica\README.md',
      '# Música de Fondo (Canal_1)' + #13#10 +
      'Pistas musicales y efectos sonoros libres de derechos de autor.' + #13#10, False);

    SaveStringToFile(CanalPath + '\Imagenes\README.md',
      '# Recursos Gráficos e Imágenes (Canal_1)' + #13#10 +
      'Banners, texturas, capturas y miniaturas generadas con IA.' + #13#10, False);

    StringChangeEx(WorkspacePath, '\', '\\', True);
    StringChangeEx(BinPath, '\', '\\', True);

    ConfigContent := '{' + #13#10 +
      '  "basePath": "' + WorkspacePath + '",' + #13#10 +
      '  "binPath": "' + BinPath + '",' + #13#10 +
      '  "version": "1.0.0"' + #13#10 +
      '}';

    SaveStringToFile(ConfigFile, ConfigContent, False);
  end;
end;
