/**
 * Full Mozaik-compatible Product templates for auto-generated end panels.
 * Extracted from FS 96.moz (floor panels) and Wall Mount 76.moz (wall panels).
 *
 * Two panel types — floor vs wall mount — differ in:
 *   - Flags, ImageFile, ProductType SubType, PartShapeXml
 *   - Floor: toe notch + baseboard notch, MatORSel, SubType=21
 *   - Wall: French cleat notch near top, LegCounts, SubType=22
 *
 * Mozaik REQUIRES the full XML structure including all empty container
 * elements (ProductDoors, ProductDrawers, etc.) — files without them crash.
 */

/** Format a number for DES output — max 4 decimal places, strip trailing zeros. */
function n(v: number): string {
  if (Number.isInteger(v)) return String(v)
  return parseFloat(v.toFixed(4)).toString()
}

// ── Floor Panel (FS 96 pattern) ────────────────────────────────────

interface FloorPanelParams {
  uniqueId: string
  idTag: number
  height: number
  depth: number
  x: number
  elev: number
  wall: string
  cabNo: number
  sourceLib: string
}

/** Full Product attribute record for a floor-standing panel (FS 96 type). */
export function floorPanelAttrs(p: FloorPanelParams): Record<string, string> {
  return {
    UniqueID: p.uniqueId,
    OrderID: '0',
    ProdName: 'Floor Panel',
    IDTag: String(p.idTag),
    ProductDesc: '',
    SourceLib: p.sourceLib,
    NonGraphic: 'False',
    ImageFile: 'FM-Panel.JPG',
    SketchUpFile: '',
    UseSUModel: '0',
    AutoFill: 'False',
    AutoDimension: 'True',
    Mirror: 'True',
    SUDirty: 'True',
    OrderDirty: 'True',
    Width: '19',
    Height: n(p.height),
    Depth: n(p.depth),
    WStretch: 'False',
    HStretch: 'False',
    DStretch: 'True',
    minW: '0',
    minH: '2133.6',
    minD: '0',
    MaxW: '0',
    MaxH: '2463.8',
    MaxD: '0',
    ModularWidths: 'False',
    ModularHeights: 'True',
    ModularDepths: 'True',
    ModularFFHeights: 'False',
    X: n(p.x),
    Elev: n(p.elev),
    Rot: '0',
    Outset: '0',
    Wall: p.wall,
    CabNo: String(p.cabNo),
    Numbered: 'True',
    SnapTo: '0',
    IsRectShape: 'False',
    DoorOR: '',
    TopDrwOR: '',
    MidDrwOR: '',
    BotDrwOR: '',
    DrwPullOR: '',
    DoorPullOR: '',
    HingeOR: '',
    GuideOR: '',
    GuideORSlowCloseOn: 'False',
    GuideORSpacerState: '1',
    ShelfPinsOR: '',
    DrawerFrontFastenerOR: '',
    LockOR: '',
    LegOR: '',
    SpotLightOR: '',
    LinearLightOR: '',
    EndDoorOR: '',
    BackDoorOR: '',
    HardwareTextureORId: '-1',
    LToeAdj: '0',
    RToeAdj: '0',
    TopDepthAdj: '0',
    BottomDepthAdj: '0',
    CurrentConst: '0',
    ShowElevDepth: 'False',
    ExtEnds: '0',
    Flags: '1111111111111111',
    NoParts: 'False',
    DoorStyle: 'MDF Flat Panel Square',
    FinInt: 'False',
    AutomateInterior: 'False',
    GrainMatched: '0',
    ScribeRefWasExterior: 'True',
    PrevInteriorScribeStileWidths: '',
    PrevInteriorScribeSideThicknesses: '',
    Count: '1',
    LockConst: 'True',
    EndsToFloor: '0',
    CornerVoidAssigned: 'False',
    Notes: '',
    Price: '90',
    PricePerM: '0',
    PricePerSqM: '0',
    Upcharge: '0',
    Weight: '0',
    IncludeInCabCount: 'True',
    IncludeInLinearCalculations: 'True',
    IncludeInSqCalculations: 'True',
    PricingColumn: '',
    NotchForLeftPanelEndFrontToe: 'True',
    NotchForLeftPanelEndBackToe: 'True',
    NotchForRightPanelEndFrontToe: 'True',
    NotchForRightPanelEndBackToe: 'True',
    NotchForLeftEndFrontToe: 'True',
    NotchForLeftEndBackToe: 'False',
    NotchForRightEndFrontToe: 'True',
    NotchForRightEndBackToe: 'False',
    ParmVersion: '17',
  }
}

/** Full inner XML for a floor-standing panel (FS 96 structure). */
export function floorPanelInnerXml(height: number, depth: number): string {
  const h = n(height)
  const d = n(depth)
  return `      <MatORSel CategoryId="3">
        <MaterialTemplateSelection RootTemplateId="-1" />
      </MatORSel>
      <ProductOptions />
      <CabProdParts>
        <CabProdPart Name="Fin End (L)" ReportName="FEnd (L)" UsageType="0" Comment="Finished End" CommentLocked="False" Quan="1" W="${d}" L="${h}" Color="None" ColorLocked="False" Type="FEnd" Q_EQ="" W_EQ="" L_EQ="" Layer="2" X="0" Y="${d}" Z="0" X_EQ="" Y_EQ="" Z_EQ="" A1="-90" A2="180" A3="0" R1="Y" R2="Z" R3="X" Face="0" A1_EQ="" A2_EQ="" A3_EQ="" Radius="0" RadAxis="0" SUPartName="" SUPartD="0">
          <PartShapeXml Version="2" Name="" Type="0" RadiusX="0" RadiusY="0" Source="0" Data1="0" Data2="0" RotAng="0" DoNotTranslateTo00="False">
            <ShapePoint ID="0" X="152.4" Y="0" PtType="0" Data="0" EdgeType="0" Anchor="" EBand="0" X_Eq="BaseBoardNotchL" Y_Eq="0" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="Back" />
            <ShapePoint ID="1" X="${h}" Y="0" PtType="0" Data="0" EdgeType="0" Anchor="" EBand="0" X_Eq="" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="Top" />
            <ShapePoint ID="2" X="${h}" Y="${d}" PtType="0" Data="0" EdgeType="0" Anchor="" EBand="1" X_Eq="" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="Front" />
            <ShapePoint ID="0" X="71.2" Y="${d}" PtType="0" Data="0" EdgeType="0" Anchor="" EBand="0" X_Eq="ToeH-ToeHReduce | If ToeH = 0 Then X= 0" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="" />
            <ShapePoint ID="3" X="71.2" Y="${d}" PtType="0" Data="0" EdgeType="0" Anchor="" EBand="0" X_Eq="ToeH-ToeHReduce | If ToeH = 0 Then X= 0" Y_Eq="PartW | If ConToeNotch = 1 Then Y= PartW-ToeR" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="Bottom" />
            <ShapePoint ID="0" X="0" Y="${d}" PtType="0" Data="0" EdgeType="0" Anchor="" EBand="0" X_Eq="" Y_Eq="PartW | If ConToeNotch = 1 Then Y= PartW-ToeR" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="" />
            <ShapePoint ID="0" X="0" Y="22.225" PtType="0" Data="0" EdgeType="0" Anchor="" EBand="0" X_Eq="" Y_Eq="0 | If BaseBoardNotch = 1 Then Y= BaseBoardNotchW" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="" />
            <ShapePoint ID="0" X="152.4" Y="22.225" PtType="0" Data="0" EdgeType="0" Anchor="" EBand="0" X_Eq="BaseBoardNotchL" Y_Eq="0 | If BaseBoardNotch = 1 Then Y= BaseBoardNotchW" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="" />
          </PartShapeXml>
          <PartTag SourceCode="1" TypeCode="22" IsAddedByCustomParm="False" IsModifiedByCustomParm="False">
            <PartTagReference Key="FaceIdx" Value="4" />
          </PartTag>
        </CabProdPart>
      </CabProdParts>
      <CabProdParms>
        <CabProdParm ProdID="0" Name="SysHoles" Desc="Linebore Holes for 32mm system" Type="2" Category="12" Value="8" Options="Use Line Bore,Shotgun Bore,Series of Holes,1 Hole per shelf,3 Holes per shelf,5 Holes per shelf,7 Holes per shelf,None" MaxVal="0" MinVal="0" />
        <CabProdParm ProdID="0" Name="SysHolesW" Desc="Linebore Holes for 32mm system (Wall)" Type="2" Category="12" Value="8" Options="Use Line Bore,Shotgun Bore,Series of Holes,1 Hole per shelf,3 Holes per shelf,5 Holes per shelf,7 Holes per shelf,None" MaxVal="0" MinVal="0" />
        <CabProdParm ProdID="0" Name="SysHolesT" Desc="Linebore Holes for 32mm system (Tall)" Type="2" Category="12" Value="8" Options="Use Line Bore,Shotgun Bore,Series of Holes,1 Hole per shelf,3 Holes per shelf,5 Holes per shelf,7 Holes per shelf,None" MaxVal="0" MinVal="0" />
        <CabProdParm ProdID="0" Name="HangRail" Desc="Add notch to vertical panel for hang rail" Type="1" Category="13" Value="0" Options="" MaxVal="0" MinVal="0" />
        <CabProdParm ProdID="0" Name="LEDConfig" Desc="Change this for individual panel only" Type="2" Category="15" Value="4" Options="Left Side,Right Side,None,Both Sides" MaxVal="0" MinVal="0" />
      </CabProdParms>
      <CustomParmEnabledORs />
      <ProductDoors />
      <ProductDrawers />
      <ProductRolloutShelves />
      <JointFastenerCounts />
      <ShelfPinCounts />
      <ProductMoldings />
      <ProductInterior MaxIntSecID="1" DelT="False" DelB="False" DelL="False" DelR="False" />
      <FrontFace MaxSecID="0" />
      <LeftFace MaxSecID="0" />
      <RightFace MaxSecID="0" />
      <BackFace MaxSecID="0" />
      <TopShapeXml Version="2" Name="" Type="1" RadiusX="0" RadiusY="0" Source="1" Data1="0" Data2="0" RotAng="0" DoNotTranslateTo00="False">
        <ShapePoint ID="0" X="0" Y="0" PtType="0" Data="0" EdgeType="14" Anchor="" EBand="0" X_Eq="" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="" />
        <ShapePoint ID="1" X="19" Y="0" PtType="0" Data="0" EdgeType="14" Anchor="" EBand="0" X_Eq="" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="" />
        <ShapePoint ID="2" X="19" Y="${d}" PtType="0" Data="0" EdgeType="14" Anchor="" EBand="0" X_Eq="" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="" />
        <ShapePoint ID="3" X="0" Y="${d}" PtType="0" Data="0" EdgeType="7" Anchor="" EBand="0" X_Eq="" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="" />
      </TopShapeXml>
      <ProductType Type="8" SubType="21" SubSubType="1" />
      <LabelDimensionOverrideMap />`
}

// ── Wall Mount Panel (Wall Mount 76 pattern) ───────────────────────

interface WallPanelParams {
  uniqueId: string
  idTag: number
  height: number
  depth: number
  x: number
  elev: number
  wall: string
  cabNo: number
  sourceLib: string
}

/** Full Product attribute record for a wall-mounted panel. */
export function wallPanelAttrs(p: WallPanelParams): Record<string, string> {
  return {
    UniqueID: p.uniqueId,
    OrderID: '0',
    ProdName: 'Wall Mount Panel',
    IDTag: String(p.idTag),
    ProductDesc: '',
    SourceLib: p.sourceLib,
    NonGraphic: 'False',
    ImageFile: 'Wall Hung Panel.JPG',
    SketchUpFile: '',
    UseSUModel: '0',
    AutoFill: 'False',
    AutoDimension: 'True',
    Mirror: 'True',
    SUDirty: 'True',
    OrderDirty: 'True',
    Width: '19.05',
    Height: n(p.height),
    Depth: n(p.depth),
    WStretch: 'False',
    HStretch: 'True',
    DStretch: 'False',
    minW: '0',
    minH: '0',
    minD: '0',
    MaxW: '0',
    MaxH: '0',
    MaxD: '0',
    ModularWidths: 'False',
    ModularHeights: 'True',
    ModularDepths: 'True',
    ModularFFHeights: 'False',
    X: n(p.x),
    Elev: n(p.elev),
    Rot: '0',
    Outset: '0',
    Wall: p.wall,
    CabNo: String(p.cabNo),
    Numbered: 'True',
    SnapTo: '0',
    IsRectShape: 'False',
    DoorOR: '',
    TopDrwOR: '',
    MidDrwOR: '',
    BotDrwOR: '',
    DrwPullOR: '',
    DoorPullOR: '',
    HingeOR: '',
    GuideOR: '',
    GuideORSlowCloseOn: 'False',
    GuideORSpacerState: '1',
    ShelfPinsOR: '',
    DrawerFrontFastenerOR: '',
    LockOR: '',
    LegOR: '',
    SpotLightOR: '',
    LinearLightOR: '',
    EndDoorOR: '',
    BackDoorOR: '',
    HardwareTextureORId: '-1',
    LToeAdj: '0',
    RToeAdj: '0',
    TopDepthAdj: '0',
    BottomDepthAdj: '0',
    CurrentConst: '0',
    ShowElevDepth: 'False',
    ExtEnds: '0',
    Flags: '0010000000000011',
    NoParts: 'False',
    DoorStyle: '',
    FinInt: 'False',
    AutomateInterior: 'False',
    GrainMatched: '0',
    ScribeRefWasExterior: 'True',
    PrevInteriorScribeStileWidths: '',
    PrevInteriorScribeSideThicknesses: '',
    Count: '1',
    LockConst: 'True',
    EndsToFloor: '0',
    CornerVoidAssigned: 'False',
    Notes: '',
    Price: '90',
    PricePerM: '0',
    PricePerSqM: '0',
    Upcharge: '0',
    Weight: '0',
    IncludeInCabCount: 'True',
    IncludeInLinearCalculations: 'True',
    IncludeInSqCalculations: 'True',
    PricingColumn: '',
    NotchForLeftPanelEndFrontToe: 'True',
    NotchForLeftPanelEndBackToe: 'True',
    NotchForRightPanelEndFrontToe: 'True',
    NotchForRightPanelEndBackToe: 'True',
    NotchForLeftEndFrontToe: 'True',
    NotchForLeftEndBackToe: 'False',
    NotchForRightEndFrontToe: 'True',
    NotchForRightEndBackToe: 'False',
    ParmVersion: '17',
  }
}

/**
 * Full inner XML for a wall-mounted panel (Wall Mount 76 structure).
 * Includes French cleat notch near the top of the panel back.
 */
export function wallPanelInnerXml(height: number, depth: number): string {
  const h = n(height)
  const d = n(depth)
  // French cleat notch: 76.2mm (3") tall, 9.525mm (3/8") deep, positioned near top
  const cleatBottom = n(height - 101.6)   // 4" from top
  const cleatTop = n(height - 25.4)       // 1" from top
  const cleatDepth = '9.525'              // 3/8"
  return `      <ProductOptions />
      <CabProdParts>
        <CabProdPart Name=" WM Panel" ReportName=" WM Panel" UsageType="0" Comment="" CommentLocked="True" Quan="1" W="${d}" L="${h}" Color="None" ColorLocked="False" Type="FEnd" Q_EQ="" W_EQ="" L_EQ="" Layer="2" X="0" Y="${d}" Z="0" X_EQ="" Y_EQ="" Z_EQ="" A1="-90" A2="180" A3="0" R1="Y" R2="Z" R3="X" Face="0" A1_EQ="" A2_EQ="" A3_EQ="" Radius="0" RadAxis="0" SUPartName="" SUPartD="0">
          <PartShapeXml Version="2" Name="" Type="1" RadiusX="0" RadiusY="0" Source="1" Data1="0" Data2="0" RotAng="0" DoNotTranslateTo00="False">
            <ShapePoint ID="0" X="0" Y="0" PtType="0" Data="0" EdgeType="0" Anchor="" EBand="0" X_Eq="" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="Back" />
            <ShapePoint ID="0" X="${cleatBottom}" Y="0" PtType="0" Data="0" EdgeType="0" Anchor="" EBand="0" X_Eq="" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="" />
            <ShapePoint ID="0" X="${cleatBottom}" Y="${cleatDepth}" PtType="0" Data="0" EdgeType="0" Anchor="" EBand="0" X_Eq="" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="" />
            <ShapePoint ID="0" X="${cleatTop}" Y="${cleatDepth}" PtType="0" Data="0" EdgeType="0" Anchor="" EBand="0" X_Eq="" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="" />
            <ShapePoint ID="0" X="${cleatTop}" Y="0" PtType="0" Data="0" EdgeType="0" Anchor="" EBand="0" X_Eq="" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="" />
            <ShapePoint ID="1" X="${h}" Y="0" PtType="0" Data="0" EdgeType="0" Anchor="" EBand="0" X_Eq="" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="Top" />
            <ShapePoint ID="2" X="${h}" Y="${d}" PtType="0" Data="0" EdgeType="0" Anchor="" EBand="0" X_Eq="" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="Front" />
            <ShapePoint ID="3" X="0" Y="${d}" PtType="0" Data="0" EdgeType="0" Anchor="" EBand="0" X_Eq="" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="Bottom" />
          </PartShapeXml>
          <PartTag SourceCode="1" TypeCode="22" IsAddedByCustomParm="False" IsModifiedByCustomParm="False">
            <PartTagReference Key="FaceIdx" Value="4" />
          </PartTag>
        </CabProdPart>
      </CabProdParts>
      <CabProdParms>
        <CabProdParm ProdID="0" Name="SysHoles" Desc="Linebore Holes for 32mm system" Type="2" Category="12" Value="8" Options="Use Line Bore,Shotgun Bore,Series of Holes,1 Hole per shelf,3 Holes per shelf,5 Holes per shelf,7 Holes per shelf,None" MaxVal="0" MinVal="0" />
        <CabProdParm ProdID="0" Name="ToeH" Desc="Toe Height" Type="0" Category="5" Value="0" Options="" MaxVal="0" MinVal="0" />
        <CabProdParm ProdID="0" Name="ToeR" Desc="Toe Recess" Type="0" Category="5" Value="0" Options="" MaxVal="0" MinVal="0" />
        <CabProdParm ProdID="0" Name="SysHolesW" Desc="Linebore Holes for 32mm system (Wall)" Type="2" Category="12" Value="8" Options="Use Line Bore,Shotgun Bore,Series of Holes,1 Hole per shelf,3 Holes per shelf,5 Holes per shelf,7 Holes per shelf,None" MaxVal="0" MinVal="0" />
        <CabProdParm ProdID="0" Name="SysHolesT" Desc="Linebore Holes for 32mm system (Tall)" Type="2" Category="12" Value="8" Options="Use Line Bore,Shotgun Bore,Series of Holes,1 Hole per shelf,3 Holes per shelf,5 Holes per shelf,7 Holes per shelf,None" MaxVal="0" MinVal="0" />
        <CabProdParm ProdID="0" Name="FinBackToeR" Desc="Finished Back Toe Recess" Type="0" Category="5" Value="0" Options="" MaxVal="0" MinVal="0" />
      </CabProdParms>
      <CustomParmEnabledORs />
      <ProductDoors />
      <ProductDrawers />
      <ProductRolloutShelves />
      <JointFastenerCounts />
      <LegCounts />
      <ShelfPinCounts />
      <ProductMoldings />
      <ProductInterior MaxIntSecID="1" DelT="False" DelB="False" DelL="False" DelR="False" />
      <FrontFace MaxSecID="0" />
      <LeftFace MaxSecID="0" />
      <RightFace MaxSecID="0" />
      <BackFace MaxSecID="0" />
      <TopShapeXml Version="2" Name="" Type="1" RadiusX="0" RadiusY="0" Source="1" Data1="0" Data2="0" RotAng="0" DoNotTranslateTo00="False">
        <ShapePoint ID="0" X="0" Y="0" PtType="0" Data="0" EdgeType="14" Anchor="" EBand="0" X_Eq="" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="" />
        <ShapePoint ID="1" X="19.05" Y="0" PtType="0" Data="0" EdgeType="14" Anchor="" EBand="0" X_Eq="" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="" />
        <ShapePoint ID="2" X="19.05" Y="${d}" PtType="0" Data="0" EdgeType="14" Anchor="" EBand="0" X_Eq="" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="" />
        <ShapePoint ID="3" X="0" Y="${d}" PtType="0" Data="0" EdgeType="7" Anchor="" EBand="0" X_Eq="" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="" />
      </TopShapeXml>
      <ProductType Type="8" SubType="22" SubSubType="1" />
      <LabelDimensionOverrideMap />`
}
