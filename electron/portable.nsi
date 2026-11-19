# Custom electron-builder portable launcher for RoA2 Notes.
# Copied over node_modules/app-builder-lib/templates/nsis/portable.nsi by
# electron/patch-portable-launcher.cjs before every electron-builder run.
#
# Differences from the stock template:
#   - Unpacks next to the .exe ("<ProductName> Files") instead of %TEMP%.
#   - Skips unpacking when that folder already holds this exact version
#     (".app-version" marker, written last so a half-finished unpack is redone).
#   - Does not delete the folder when the app exits.

!include "common.nsh"
!include "extractAppPackage.nsh"

# https://github.com/electron-userland/electron-builder/issues/3972#issuecomment-505171582
CRCCheck off
WindowIcon Off
AutoCloseWindow True
RequestExecutionLevel ${REQUEST_EXECUTION_LEVEL}

Function .onInit
  !ifndef SPLASH_IMAGE
    SetSilent silent
  !endif

  !insertmacro check64BitAndSetRegView
FunctionEnd

Function .onGUIInit
  InitPluginsDir

  !ifdef SPLASH_IMAGE
    File /oname=$PLUGINSDIR\splash.bmp "${SPLASH_IMAGE}"
    BgImage::SetBg $PLUGINSDIR\splash.bmp
    BgImage::Redraw
  !endif
FunctionEnd

Section
  !ifdef SPLASH_IMAGE
    HideWindow
  !endif

  StrCpy $INSTDIR "$EXEDIR\${PRODUCT_FILENAME} Files"

  # Read the version marker left by the last unpack (empty if missing).
  StrCpy $R1 ""
  ClearErrors
  FileOpen $R2 "$INSTDIR\.app-version" r
  ${IfNot} ${Errors}
    FileRead $R2 $R1
    FileClose $R2
  ${EndIf}

  ${If} $R1 != "${VERSION}"
  ${OrIfNot} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    RMDir /r $INSTDIR
    SetOutPath $INSTDIR

    !ifdef APP_DIR_64
      File /r "${APP_DIR_64}\*.*"
    !else
      !ifdef APP_DIR_32
        File /r "${APP_DIR_32}\*.*"
      !else
        !insertmacro extractEmbeddedAppPackage
      !endif
    !endif

    FileOpen $R2 "$INSTDIR\.app-version" w
    FileWrite $R2 "${VERSION}"
    FileClose $R2
  ${EndIf}

  SetOutPath $INSTDIR

  System::Call 'Kernel32::SetEnvironmentVariable(t, t)i ("PORTABLE_EXECUTABLE_DIR", "$EXEDIR").r0'
  System::Call 'Kernel32::SetEnvironmentVariable(t, t)i ("PORTABLE_EXECUTABLE_FILE", "$EXEPATH").r0'
  System::Call 'Kernel32::SetEnvironmentVariable(t, t)i ("PORTABLE_EXECUTABLE_APP_FILENAME", "${APP_FILENAME}").r0'
  ${StdUtils.GetAllParameters} $R0 0

  !ifdef SPLASH_IMAGE
    BgImage::Destroy
  !endif

  ExecWait "$INSTDIR\${APP_EXECUTABLE_FILENAME} $R0" $0
  SetErrorLevel $0
SectionEnd
