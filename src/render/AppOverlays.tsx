/**
 * AppOverlays — PartInspector, PartShapeInspector, AdminPanel, ElevationViewer, DragOverlay, missing models alert.
 */
import { useAppState, useAppDispatch } from '../store'
import type { MozFile, LibraryConfig, CabProdParm } from '../mozaik/types'
import type { LibraryFolder } from '../mozaik/libraryNdxParser'
import PartInspector from './PartInspector'
import PartShapeInspector from './PartShapeInspector'
import AdminPanel from './AdminPanel'
import ElevationViewer from './ElevationViewer'
import DragOverlay from './DragOverlay'
import { computeAutoEndPanels } from '../mozaik/autoEndPanels'
import type { DynamicProductGroup } from '../mozaik/types'

interface Props {
  missingModels: string[]
  folderTree: LibraryFolder[]
  productParams: Record<string, CabProdParm[]>
  loadFromLibrary: (filenames: string[]) => void
  handlePlaceProduct: (productIndex: number, wallNumber?: number, unitTypeId?: string) => void
  handlePlaceGroup: (group: DynamicProductGroup, wallNumber?: number) => void
}

export default function AppOverlays({
  missingModels, folderTree, productParams,
  loadFromLibrary, handlePlaceProduct, handlePlaceGroup,
}: Props) {
  const state = useAppState()
  const dispatch = useAppDispatch()

  return (
    <>
      {missingModels.length > 0 && (
        <div className="absolute bottom-2 left-2 right-2 bg-yellow-900/80 text-yellow-200 text-xs p-2 rounded max-h-24 overflow-y-auto font-mono">
          <div className="font-bold mb-1">Missing GLB models ({missingModels.length}):</div>
          {missingModels.map(name => <div key={name}>{name}</div>)}
        </div>
      )}

      <PartInspector />

      {state.inspectedPart && (() => {
        const product = state.room?.products[state.inspectedPart.productIndex]
          ?? state.standaloneProducts[state.inspectedPart.productIndex]?.product
        const part = product?.parts[state.inspectedPart.partIndex]
        if (!product || !part) return null
        return (
          <PartShapeInspector
            product={product}
            part={part}
            partIndex={state.inspectedPart.partIndex}
            partCount={product.parts.length}
            useInches={state.useInches}
            onClose={() => dispatch({ type: 'CLEAR_INSPECTION' })}
            onCyclePart={(idx) => dispatch({ type: 'INSPECT_PART', part: { productIndex: state.inspectedPart!.productIndex, partIndex: idx } })}
          />
        )
      })()}

      {state.adminOpen && (
        <AdminPanel
          folderTree={folderTree}
          availableLibraryFiles={state.availableLibraryFiles}
          libraryConfig={state.libraryConfig}
          productParams={productParams}
          libraryFolder={state.libraryFolder}
          onUpdateConfig={(config) => dispatch({ type: 'SET_LIBRARY_CONFIG', config })}
          onRemoveProduct={(filename) => dispatch({ type: 'REMOVE_MOZ', filename })}
          onLoadProducts={loadFromLibrary}
          onClose={() => dispatch({ type: 'TOGGLE_ADMIN' })}
        />
      )}

      {state.elevationViewerProduct !== null && state.room && (() => {
        const evProduct = state.room.products[state.elevationViewerProduct]
        if (!evProduct) return null
        const allPanels = computeAutoEndPanels(
          state.room.products, state.room.walls, state.room.wallJoints, state.flipOps,
        )
        const adjPanels = allPanels.filter(p =>
          p.adjacentProductIndex === state.elevationViewerProduct ||
          p.leftAdjacentIndex === state.elevationViewerProduct ||
          p.rightAdjacentIndex === state.elevationViewerProduct
        )
        return (
          <ElevationViewer
            product={evProduct}
            productIndex={state.elevationViewerProduct}
            useInches={state.useInches}
            adjacentPanels={adjPanels}
            onClose={() => dispatch({ type: 'CLOSE_ELEVATION_VIEWER' })}
            onMoveShelf={(shelfPartIndex, newZ) =>
              dispatch({ type: 'UPDATE_SHELF_HEIGHT', productIndex: state.elevationViewerProduct!, shelfPartIndex, newZ })
            }
            onDeletePart={(partIndex) =>
              dispatch({ type: 'DELETE_PRODUCT_PART', productIndex: state.elevationViewerProduct!, partIndex })
            }
            onDragStart={() => dispatch({ type: 'BEGIN_DRAG' })}
            onDragEnd={() => dispatch({ type: 'END_DRAG' })}
          />
        )
      })()}

      {state.dragProduct && (
        <DragOverlay
          dragProduct={state.dragProduct}
          dragHoveredWall={state.dragHoveredWall}
          onDrop={(productIndex, wallNumber, group, unitTypeId) => {
            if (group) {
              handlePlaceGroup(group, wallNumber)
            } else {
              handlePlaceProduct(productIndex, wallNumber, unitTypeId)
            }
            dispatch({ type: 'END_PRODUCT_DRAG' })
          }}
          onCancel={() => dispatch({ type: 'END_PRODUCT_DRAG' })}
        />
      )}
    </>
  )
}
