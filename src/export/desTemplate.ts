import type { MozRoomParms } from '../mozaik/types'

/**
 * Full RoomParms + RoomSet templates extracted from a known-good Mozaik DES file.
 * Mozaik REQUIRES these sections — files without them crash instantly on load.
 *
 * Source: Mozaik Samples/SingleDraw V1-0-1 Test Room/Room0.des (lines 4-168)
 */

/** Format a number for DES output. */
function n(v: number): string {
  return String(v)
}

/**
 * Generate the full <RoomParms .../> line.
 * Substitutes room-specific values; all other attributes use safe defaults.
 */
export function roomParmsXml(p: MozRoomParms): string {
  return `  <RoomParms SourceTemplateID="0" H_Walls="${n(p.H_Walls)}" H_Soffit="${n(p.H_Soffit)}" H_BaseCab="${n(p.H_BaseCab)}" H_WallCab="${n(p.H_WallCab)}" H_FridgeCab="457.4862" H_RangeCab="609.6" H_VanityCab="774.7" D_Wall="${n(p.D_Wall)}" D_Base="${n(p.D_Base)}" D_Tall="${n(p.D_Tall)}" Cl_Fridge="25.4159" Cl_Window="76.2" Cl_Door="76.2" Cl_Range="0" CT_Thick="31.75" CT_FrOLay="25.4" CT_FEOlay="25.4" CT_Splash="101.6" CT_Face="31.75" CT_SplashThick="19.05" CT_DefaultSinkOverlay="25.4" CT_DefaultSinkSetback="0" CT_DefaultSinkRadius="25.4" CT_CornerConfig="1" M_CeilOffset="0" M_CrownOffset="0" M_LightRailOffset="0" M_ElevChairRail="812.8" M_ElevCustom="1066.8" SinkCabW="914.9724" WallThickness="${n(p.WallThickness)}" StartingCabNo="${n(p.StartingCabNo)}" AutoToeSkin="True" LockCabNos="False" />`
}

/**
 * Full <RoomSet> block — verbatim from Room0.des.
 * Contains door settings, material templates, hardware assignments, texture IDs.
 * Mozaik requires every sub-element; omitting any causes a crash.
 */
export const ROOM_SET_XML = `  <RoomSet Version="8" PricingColumns="1 GOLA Cabinets/#LIBRARY_COLUMN#" SourceTemplateID="16" NonColumnBaseDoor="Slab Door" NonColumnWallDoor="Slab Door" NonColumnTopDrawer="Slab H Drawer" NonColumnMidDrawer="Slab H Drawer" NonColumnBotDrawer="Slab H Drawer" DrawerBox="_PAC Richie 828 (Pocket Hole) Blind Dado" DrawerGuide="_PAC Richie 828 (Wood 3-4 Material)" DrawerGuideSlowCloseOn="False" DrawerGuideSpacerState="1" DrawerFrontFastener="" ROTray="" ROTrayGuide="_PAC Richie 828 (Wood 5-8 Material)" ROTrayGuideSlowCloseOn="False" ROTrayGuideSpacerState="1" ROTrayFrontFastener="" ROShelfGuide="KV Side Mount 8400" DrwPulls="Wire Pull" BasePulls="Wire Pull" WallPulls="Wire Pull" BaseHinges="_PAC In-Line 1-2 OL Frameless" WallHinges="_PAC In-Line 1-2 OL Frameless" ClosetRod="_PAC Richelieu Black Rod" ShelfPins="_PAC Titus Q-Peg" Locks="#NONE#" Legs="_PAC Hafele Axilo 78 Square (Press Fit)" SpotLights="_PAC Spot White Light" LinearLights="_PAC Warm Linear Light" AutofillLib="1 PAC Closet Library V2" WallsTextureId="1129" FloorTextureId="1248" WindowsDoorsTextureId="1114" MasonryTextureId="1129" CeilingTextureId="1129" HardwareTextureId="1074" ApplianceTextureId="1074" AppliancePullTextureId="1074" SinkTextureId="1074" FaucetTextureId="1074" ElectricalTextureId="1074" PlumbingTextureId="1074" UpholsteryTextureId="1074" FurnitureTextureId="1074" DecorativeTextureId="1074" AccentTextureId="1074" GlassTextureId="975" RoomDoorLibName="PAC MDF DOORS" EndDoorW="Slab Door" EndDoorB="Slab Door" EndDoorT="Slab Door" BackDoor="Slab Door">
    <NonColumnBaseDoorSettings TopRail="63.5" BottomRail="63.5" Stiles="63.5" CenterStile="63.5" CenterRail="63.5" StileRailInset="12.7" PanelInsetTop="12.7" PanelInsetBottom="12.7" PanelInsetSide="12.7" PanelRecess="7.9375" RoutedUseCutoutTool="True" RoutedOutsideEdgeToolID="-1" RoutedOutsideEdgeToolGroupID="-1" RoutedDoorToolGroupID="2" RoutedGlassDoorPanelCutoutToolID="3" RoutedPocketingToolID="60" RoutedPocketingInsideOut="True" RoutedPocketingCCW="False" TraditionalOutsideEdgeProfileID="3" TraditionalInsideFrameProfileID="18" TraditionalPanelProfileID="15" MitreOutsideEdgeProfileID="-1" MitreFrameProfileID="-1" MitrePanelProfileID="-1" IsBeadingDouble="False" BeadingShowHighDetail="True" BeadingWidth="6.35" BeadingSpaceBetween="25.4" BeadingCutDepth="4.7625" BeadingStopDistance="8.89" BeadingToolID="-1" SeparatePanelInsetTop="0" SeparatePanelInsetBottom="0" SeparatePanelInsetSides="0" SeparatePanelCornerRadius="0" AppliedMoldingProfileID="-1">
      <DefaultRailShapeA RailLoc="0" RailShape="1" Value="38.1" />
      <DefaultRailShapeA RailLoc="0" RailShape="5" Value="101.6" />
      <DefaultRailShapeA RailLoc="0" RailShape="2" Value="19.05" />
      <DefaultRailShapeA RailLoc="0" RailShape="4" Value="50.8" />
      <DefaultRailShapeB RailLoc="0" RailShape="5" Value="63.5" />
      <DefaultRailShapeB RailLoc="0" RailShape="2" Value="63.5" />
      <DefaultRailShapeB RailLoc="0" RailShape="4" Value="50.8" />
      <DefaultRailShapeB RailLoc="0" RailShape="3" Value="38.1" />
    </NonColumnBaseDoorSettings>
    <NonColumnWallDoorSettings TopRail="63.5" BottomRail="63.5" Stiles="63.5" CenterStile="63.5" CenterRail="63.5" StileRailInset="12.7" PanelInsetTop="12.7" PanelInsetBottom="12.7" PanelInsetSide="12.7" PanelRecess="7.9375" RoutedUseCutoutTool="True" RoutedOutsideEdgeToolID="-1" RoutedOutsideEdgeToolGroupID="-1" RoutedDoorToolGroupID="2" RoutedGlassDoorPanelCutoutToolID="3" RoutedPocketingToolID="60" RoutedPocketingInsideOut="True" RoutedPocketingCCW="False" TraditionalOutsideEdgeProfileID="3" TraditionalInsideFrameProfileID="18" TraditionalPanelProfileID="15" MitreOutsideEdgeProfileID="-1" MitreFrameProfileID="-1" MitrePanelProfileID="-1" IsBeadingDouble="False" BeadingShowHighDetail="True" BeadingWidth="6.35" BeadingSpaceBetween="25.4" BeadingCutDepth="4.7625" BeadingStopDistance="8.89" BeadingToolID="-1" SeparatePanelInsetTop="0" SeparatePanelInsetBottom="0" SeparatePanelInsetSides="0" SeparatePanelCornerRadius="0" AppliedMoldingProfileID="-1">
      <DefaultRailShapeA RailLoc="0" RailShape="1" Value="38.1" />
      <DefaultRailShapeA RailLoc="0" RailShape="5" Value="101.6" />
      <DefaultRailShapeA RailLoc="0" RailShape="2" Value="19.05" />
      <DefaultRailShapeA RailLoc="0" RailShape="4" Value="50.8" />
      <DefaultRailShapeB RailLoc="0" RailShape="5" Value="63.5" />
      <DefaultRailShapeB RailLoc="0" RailShape="2" Value="63.5" />
      <DefaultRailShapeB RailLoc="0" RailShape="4" Value="50.8" />
      <DefaultRailShapeB RailLoc="0" RailShape="3" Value="38.1" />
    </NonColumnWallDoorSettings>
    <NonColumnTopDrawerSettings TopRail="63.5" BottomRail="63.5" Stiles="63.5" CenterStile="63.5" CenterRail="63.5" StileRailInset="12.7" PanelInsetTop="12.7" PanelInsetBottom="12.7" PanelInsetSide="12.7" PanelRecess="7.9375" RoutedUseCutoutTool="True" RoutedOutsideEdgeToolID="-1" RoutedOutsideEdgeToolGroupID="-1" RoutedDoorToolGroupID="2" RoutedGlassDoorPanelCutoutToolID="3" RoutedPocketingToolID="60" RoutedPocketingInsideOut="True" RoutedPocketingCCW="False" TraditionalOutsideEdgeProfileID="3" TraditionalInsideFrameProfileID="18" TraditionalPanelProfileID="15" MitreOutsideEdgeProfileID="-1" MitreFrameProfileID="-1" MitrePanelProfileID="-1" IsBeadingDouble="False" BeadingShowHighDetail="True" BeadingWidth="6.35" BeadingSpaceBetween="25.4" BeadingCutDepth="4.7625" BeadingStopDistance="8.89" BeadingToolID="-1" SeparatePanelInsetTop="0" SeparatePanelInsetBottom="0" SeparatePanelInsetSides="0" SeparatePanelCornerRadius="0" AppliedMoldingProfileID="-1">
      <DefaultRailShapeA RailLoc="0" RailShape="1" Value="38.1" />
      <DefaultRailShapeA RailLoc="0" RailShape="5" Value="101.6" />
      <DefaultRailShapeA RailLoc="0" RailShape="2" Value="19.05" />
      <DefaultRailShapeA RailLoc="0" RailShape="4" Value="50.8" />
      <DefaultRailShapeB RailLoc="0" RailShape="5" Value="63.5" />
      <DefaultRailShapeB RailLoc="0" RailShape="2" Value="63.5" />
      <DefaultRailShapeB RailLoc="0" RailShape="4" Value="50.8" />
      <DefaultRailShapeB RailLoc="0" RailShape="3" Value="38.1" />
    </NonColumnTopDrawerSettings>
    <NonColumnMidDrawerSettings TopRail="63.5" BottomRail="63.5" Stiles="63.5" CenterStile="63.5" CenterRail="63.5" StileRailInset="12.7" PanelInsetTop="12.7" PanelInsetBottom="12.7" PanelInsetSide="12.7" PanelRecess="7.9375" RoutedUseCutoutTool="True" RoutedOutsideEdgeToolID="-1" RoutedOutsideEdgeToolGroupID="-1" RoutedDoorToolGroupID="2" RoutedGlassDoorPanelCutoutToolID="3" RoutedPocketingToolID="60" RoutedPocketingInsideOut="True" RoutedPocketingCCW="False" TraditionalOutsideEdgeProfileID="3" TraditionalInsideFrameProfileID="18" TraditionalPanelProfileID="15" MitreOutsideEdgeProfileID="-1" MitreFrameProfileID="-1" MitrePanelProfileID="-1" IsBeadingDouble="False" BeadingShowHighDetail="True" BeadingWidth="6.35" BeadingSpaceBetween="25.4" BeadingCutDepth="4.7625" BeadingStopDistance="8.89" BeadingToolID="-1" SeparatePanelInsetTop="0" SeparatePanelInsetBottom="0" SeparatePanelInsetSides="0" SeparatePanelCornerRadius="0" AppliedMoldingProfileID="-1">
      <DefaultRailShapeA RailLoc="0" RailShape="1" Value="38.1" />
      <DefaultRailShapeA RailLoc="0" RailShape="5" Value="101.6" />
      <DefaultRailShapeA RailLoc="0" RailShape="2" Value="19.05" />
      <DefaultRailShapeA RailLoc="0" RailShape="4" Value="50.8" />
      <DefaultRailShapeB RailLoc="0" RailShape="5" Value="63.5" />
      <DefaultRailShapeB RailLoc="0" RailShape="2" Value="63.5" />
      <DefaultRailShapeB RailLoc="0" RailShape="4" Value="50.8" />
      <DefaultRailShapeB RailLoc="0" RailShape="3" Value="38.1" />
    </NonColumnMidDrawerSettings>
    <NonColumnBotDrawerSettings TopRail="63.5" BottomRail="63.5" Stiles="63.5" CenterStile="63.5" CenterRail="63.5" StileRailInset="12.7" PanelInsetTop="12.7" PanelInsetBottom="12.7" PanelInsetSide="12.7" PanelRecess="7.9375" RoutedUseCutoutTool="True" RoutedOutsideEdgeToolID="-1" RoutedOutsideEdgeToolGroupID="-1" RoutedDoorToolGroupID="2" RoutedGlassDoorPanelCutoutToolID="3" RoutedPocketingToolID="60" RoutedPocketingInsideOut="True" RoutedPocketingCCW="False" TraditionalOutsideEdgeProfileID="3" TraditionalInsideFrameProfileID="18" TraditionalPanelProfileID="15" MitreOutsideEdgeProfileID="-1" MitreFrameProfileID="-1" MitrePanelProfileID="-1" IsBeadingDouble="False" BeadingShowHighDetail="True" BeadingWidth="6.35" BeadingSpaceBetween="25.4" BeadingCutDepth="4.7625" BeadingStopDistance="8.89" BeadingToolID="-1" SeparatePanelInsetTop="0" SeparatePanelInsetBottom="0" SeparatePanelInsetSides="0" SeparatePanelCornerRadius="0" AppliedMoldingProfileID="-1">
      <DefaultRailShapeA RailLoc="0" RailShape="1" Value="38.1" />
      <DefaultRailShapeA RailLoc="0" RailShape="5" Value="101.6" />
      <DefaultRailShapeA RailLoc="0" RailShape="2" Value="19.05" />
      <DefaultRailShapeA RailLoc="0" RailShape="4" Value="50.8" />
      <DefaultRailShapeB RailLoc="0" RailShape="5" Value="63.5" />
      <DefaultRailShapeB RailLoc="0" RailShape="2" Value="63.5" />
      <DefaultRailShapeB RailLoc="0" RailShape="4" Value="50.8" />
      <DefaultRailShapeB RailLoc="0" RailShape="3" Value="38.1" />
    </NonColumnBotDrawerSettings>
    <EndDoorWSettings TopRail="63.5" BottomRail="63.5" Stiles="63.5" CenterStile="63.5" CenterRail="63.5" StileRailInset="12.7" PanelInsetTop="12.7" PanelInsetBottom="12.7" PanelInsetSide="12.7" PanelRecess="7.9375" RoutedUseCutoutTool="True" RoutedOutsideEdgeToolID="-1" RoutedOutsideEdgeToolGroupID="-1" RoutedDoorToolGroupID="2" RoutedGlassDoorPanelCutoutToolID="3" RoutedPocketingToolID="60" RoutedPocketingInsideOut="True" RoutedPocketingCCW="False" TraditionalOutsideEdgeProfileID="3" TraditionalInsideFrameProfileID="18" TraditionalPanelProfileID="15" MitreOutsideEdgeProfileID="-1" MitreFrameProfileID="-1" MitrePanelProfileID="-1" IsBeadingDouble="False" BeadingShowHighDetail="True" BeadingWidth="6.35" BeadingSpaceBetween="25.4" BeadingCutDepth="4.7625" BeadingStopDistance="8.89" BeadingToolID="-1" SeparatePanelInsetTop="0" SeparatePanelInsetBottom="0" SeparatePanelInsetSides="0" SeparatePanelCornerRadius="0" AppliedMoldingProfileID="-1">
      <DefaultRailShapeA RailLoc="0" RailShape="1" Value="38.1" />
      <DefaultRailShapeA RailLoc="0" RailShape="5" Value="101.6" />
      <DefaultRailShapeA RailLoc="0" RailShape="2" Value="19.05" />
      <DefaultRailShapeA RailLoc="0" RailShape="4" Value="50.8" />
      <DefaultRailShapeB RailLoc="0" RailShape="5" Value="63.5" />
      <DefaultRailShapeB RailLoc="0" RailShape="2" Value="63.5" />
      <DefaultRailShapeB RailLoc="0" RailShape="4" Value="50.8" />
      <DefaultRailShapeB RailLoc="0" RailShape="3" Value="38.1" />
    </EndDoorWSettings>
    <EndDoorBSettings TopRail="63.5" BottomRail="63.5" Stiles="63.5" CenterStile="63.5" CenterRail="63.5" StileRailInset="12.7" PanelInsetTop="12.7" PanelInsetBottom="12.7" PanelInsetSide="12.7" PanelRecess="7.9375" RoutedUseCutoutTool="True" RoutedOutsideEdgeToolID="-1" RoutedOutsideEdgeToolGroupID="-1" RoutedDoorToolGroupID="2" RoutedGlassDoorPanelCutoutToolID="3" RoutedPocketingToolID="60" RoutedPocketingInsideOut="True" RoutedPocketingCCW="False" TraditionalOutsideEdgeProfileID="3" TraditionalInsideFrameProfileID="18" TraditionalPanelProfileID="15" MitreOutsideEdgeProfileID="-1" MitreFrameProfileID="-1" MitrePanelProfileID="-1" IsBeadingDouble="False" BeadingShowHighDetail="True" BeadingWidth="6.35" BeadingSpaceBetween="25.4" BeadingCutDepth="4.7625" BeadingStopDistance="8.89" BeadingToolID="-1" SeparatePanelInsetTop="0" SeparatePanelInsetBottom="0" SeparatePanelInsetSides="0" SeparatePanelCornerRadius="0" AppliedMoldingProfileID="-1">
      <DefaultRailShapeA RailLoc="0" RailShape="1" Value="38.1" />
      <DefaultRailShapeA RailLoc="0" RailShape="5" Value="101.6" />
      <DefaultRailShapeA RailLoc="0" RailShape="2" Value="19.05" />
      <DefaultRailShapeA RailLoc="0" RailShape="4" Value="50.8" />
      <DefaultRailShapeB RailLoc="0" RailShape="5" Value="63.5" />
      <DefaultRailShapeB RailLoc="0" RailShape="2" Value="63.5" />
      <DefaultRailShapeB RailLoc="0" RailShape="4" Value="50.8" />
      <DefaultRailShapeB RailLoc="0" RailShape="3" Value="38.1" />
    </EndDoorBSettings>
    <EndDoorTSettings TopRail="63.5" BottomRail="63.5" Stiles="63.5" CenterStile="63.5" CenterRail="63.5" StileRailInset="12.7" PanelInsetTop="12.7" PanelInsetBottom="12.7" PanelInsetSide="12.7" PanelRecess="7.9375" RoutedUseCutoutTool="True" RoutedOutsideEdgeToolID="-1" RoutedOutsideEdgeToolGroupID="-1" RoutedDoorToolGroupID="2" RoutedGlassDoorPanelCutoutToolID="3" RoutedPocketingToolID="60" RoutedPocketingInsideOut="True" RoutedPocketingCCW="False" TraditionalOutsideEdgeProfileID="3" TraditionalInsideFrameProfileID="18" TraditionalPanelProfileID="15" MitreOutsideEdgeProfileID="-1" MitreFrameProfileID="-1" MitrePanelProfileID="-1" IsBeadingDouble="False" BeadingShowHighDetail="True" BeadingWidth="6.35" BeadingSpaceBetween="25.4" BeadingCutDepth="4.7625" BeadingStopDistance="8.89" BeadingToolID="-1" SeparatePanelInsetTop="0" SeparatePanelInsetBottom="0" SeparatePanelInsetSides="0" SeparatePanelCornerRadius="0" AppliedMoldingProfileID="-1">
      <DefaultRailShapeA RailLoc="0" RailShape="1" Value="38.1" />
      <DefaultRailShapeA RailLoc="0" RailShape="5" Value="101.6" />
      <DefaultRailShapeA RailLoc="0" RailShape="2" Value="19.05" />
      <DefaultRailShapeA RailLoc="0" RailShape="4" Value="50.8" />
      <DefaultRailShapeB RailLoc="0" RailShape="5" Value="63.5" />
      <DefaultRailShapeB RailLoc="0" RailShape="2" Value="63.5" />
      <DefaultRailShapeB RailLoc="0" RailShape="4" Value="50.8" />
      <DefaultRailShapeB RailLoc="0" RailShape="3" Value="38.1" />
    </EndDoorTSettings>
    <BackDoorSettings TopRail="63.5" BottomRail="63.5" Stiles="63.5" CenterStile="63.5" CenterRail="63.5" StileRailInset="12.7" PanelInsetTop="12.7" PanelInsetBottom="12.7" PanelInsetSide="12.7" PanelRecess="7.9375" RoutedUseCutoutTool="True" RoutedOutsideEdgeToolID="-1" RoutedOutsideEdgeToolGroupID="-1" RoutedDoorToolGroupID="2" RoutedGlassDoorPanelCutoutToolID="3" RoutedPocketingToolID="60" RoutedPocketingInsideOut="True" RoutedPocketingCCW="False" TraditionalOutsideEdgeProfileID="3" TraditionalInsideFrameProfileID="18" TraditionalPanelProfileID="15" MitreOutsideEdgeProfileID="-1" MitreFrameProfileID="-1" MitrePanelProfileID="-1" IsBeadingDouble="False" BeadingShowHighDetail="True" BeadingWidth="6.35" BeadingSpaceBetween="25.4" BeadingCutDepth="4.7625" BeadingStopDistance="8.89" BeadingToolID="-1" SeparatePanelInsetTop="0" SeparatePanelInsetBottom="0" SeparatePanelInsetSides="0" SeparatePanelCornerRadius="0" AppliedMoldingProfileID="-1">
      <DefaultRailShapeA RailLoc="0" RailShape="1" Value="38.1" />
      <DefaultRailShapeA RailLoc="0" RailShape="5" Value="101.6" />
      <DefaultRailShapeA RailLoc="0" RailShape="2" Value="19.05" />
      <DefaultRailShapeA RailLoc="0" RailShape="4" Value="50.8" />
      <DefaultRailShapeB RailLoc="0" RailShape="5" Value="63.5" />
      <DefaultRailShapeB RailLoc="0" RailShape="2" Value="63.5" />
      <DefaultRailShapeB RailLoc="0" RailShape="4" Value="50.8" />
      <DefaultRailShapeB RailLoc="0" RailShape="3" Value="38.1" />
    </BackDoorSettings>
    <BaseMatTempSel CategoryId="3">
      <MaterialTemplateSelection RootTemplateId="25" MissingTemplateName="_ABC White Mel 3-4">
        <TextureIdOverrideByPartType PartType="RAIL" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="STILE" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="FRAME" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="FRAMELESSRAIL" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="NOSING" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="TOE" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="TOESKIN" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="FEND" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="FBACK" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="FINSKIN" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="FINEXTERIOR" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="FININTERIOR" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="FININTERIORBACK" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="CLEAT" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="TOP" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="BOTTOM" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="UEND" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="APPLIEDUE" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="SHELF" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="ROLLOUTSHELF" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="FIXEDSHELF" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="ADJUSTABLESHELF" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="PARTITION" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="DIVIDER" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="UBACK" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="NAILER" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="STRETCHER" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="UFINEXTERIOR" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="UFININTERIOR" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="UFINSKIN" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="SLEEPER" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="SPECIAL" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="CLOSETROD" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="MOLDING" Id="227" ManuallyChanged="False" />
      </MaterialTemplateSelection>
    </BaseMatTempSel>
    <BaseMatTempSel CategoryId="1">
      <MaterialTemplateSelection RootTemplateId="33" MissingTemplateName="3/4 MDF White HG" />
    </BaseMatTempSel>
    <BaseMatTempSel CategoryId="2">
      <MaterialTemplateSelection RootTemplateId="3" MissingTemplateName="_ABC  White Mel">
        <TextureIdOverrideByPartType PartType="DRAWERSIDE" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="DRAWERFRONT" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="DRAWERBACK" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="DRAWERBOTTOM" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="TRAYSIDE" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="TRAYFRONT" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="TRAYBACK" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="TRAYBOTTOM" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="TRAYFACE" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="DRAWERPARTITION" Id="2" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="DRAWERDIVIDER" Id="2" ManuallyChanged="False" />
      </MaterialTemplateSelection>
    </BaseMatTempSel>
    <BaseMatTempSel CategoryId="4">
      <MaterialTemplateSelection RootTemplateId="46" MissingTemplateName="3-4 Melamine Tops">
        <TextureIdOverrideByPartType PartType="COUNTERTOP" Id="544" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="SPLASH" Id="544" ManuallyChanged="False" />
      </MaterialTemplateSelection>
    </BaseMatTempSel>
    <BaseMatTempSel CategoryId="5">
      <MaterialTemplateSelection RootTemplateId="71" MissingTemplateName="PVC Banding">
        <TextureIdOverrideByPartType PartType="EDGEBAND" Id="227" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="EDGEBAND2" Id="227" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="EDGEBAND3" Id="227" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="EDGEBAND4" Id="227" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="EDGEBAND5" Id="227" ManuallyChanged="False" />
        <TextureIdOverrideByPartType PartType="EDGEBAND6" Id="227" ManuallyChanged="False" />
      </MaterialTemplateSelection>
    </BaseMatTempSel>
  </RoomSet>`
