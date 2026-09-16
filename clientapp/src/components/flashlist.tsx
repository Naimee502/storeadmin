import React, { memo, useCallback } from 'react';
import {
    RefreshControl,
    StyleProp,
    ViewStyle,
} from 'react-native';

import {
    FlashList,
    FlashListProps,
} from '@shopify/flash-list';

type DynamicFlashListProps<T> = {
    data: readonly T[];

    renderItem: NonNullable<
        FlashListProps<T>['renderItem']
    >;

    keyExtractor?: (
        item: T,
        index: number,
    ) => string;

    estimatedItemSize?: number;

    numColumns?: number;

    refreshing?: boolean;
    onRefresh?: () => void;

    onEndReached?: () => void;
    onEndReachedThreshold?: number;

    ListEmptyComponent?: React.ReactElement | null;

    ListHeaderComponent?:
    | React.ReactElement
    | null;

    ListFooterComponent?:
    | React.ReactElement
    | null;

    contentContainerStyle?: StyleProp<ViewStyle>;

    showsVerticalScrollIndicator?: boolean;

    showsHorizontalScrollIndicator?: boolean;

    horizontal?: boolean;

    scrollEnabled?: boolean;

    extraData?: unknown;

    removeClippedSubviews?: boolean;

    drawDistance?: number;
};

function FlashListComponent<T>({
    data,
    renderItem,
    keyExtractor,

    /**
     * Accepted and ignored.
     *
     * FlashList v2 measures items itself; `estimatedItemSize` was removed from
     * its props, and forwarding it is a type error. Two dozen call sites still
     * pass a number, so the prop stays in this wrapper's signature — dropping
     * it would be a rename across the app for no behavioural gain — but it
     * goes no further than here.
     */
    estimatedItemSize: _estimatedItemSize = 200,

    numColumns = 1,

    refreshing = false,
    onRefresh,

    onEndReached,
    onEndReachedThreshold = 0.5,

    ListEmptyComponent = null,
    ListHeaderComponent = null,
    ListFooterComponent = null,

    contentContainerStyle,

    showsVerticalScrollIndicator = false,
    showsHorizontalScrollIndicator = false,

    horizontal = false,
    scrollEnabled = true,

    extraData,

    /**
     * Accepted and ignored, and the default is the reason.
     *
     * FlashList v2 clips for itself; this prop is not one of its own, it
     * reaches the ScrollView underneath through ScrollViewProps. React
     * Native's own documentation warns that on Android it can leave content
     * missing, and a recycling list is exactly where that shows: a cell is
     * detached, comes back empty, and re-renders — which reads as a picture
     * that keeps having to load again. No call site asks for it; this default
     * was applying it to every list in the app.
     */
    removeClippedSubviews: _removeClippedSubviews = true,

    drawDistance = 250,
}: DynamicFlashListProps<T>) {
    const memoizedRenderItem =
        useCallback(
            renderItem,
            [renderItem],
        );

    const defaultKeyExtractor =
        useCallback(
            (
                item: T,
                index: number,
            ): string => {
                if (
                    typeof item === 'object' &&
                    item !== null &&
                    'id' in item
                ) {
                    return String(
                        (
                            item as {
                                id: string | number;
                            }
                        ).id,
                    );
                }

                return index.toString();
            },
            [],
        );

    return (
        <FlashList
            data={data}
            renderItem={memoizedRenderItem}
            keyExtractor={
                keyExtractor ??
                defaultKeyExtractor
            }
            numColumns={numColumns}
            horizontal={horizontal}
            scrollEnabled={scrollEnabled}
            extraData={extraData}
            showsVerticalScrollIndicator={
                showsVerticalScrollIndicator
            }
            showsHorizontalScrollIndicator={
                showsHorizontalScrollIndicator
            }
            contentContainerStyle={
                contentContainerStyle
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={
                onEndReachedThreshold
            }
            ListEmptyComponent={
                ListEmptyComponent
            }
            ListHeaderComponent={
                ListHeaderComponent
            }
            ListFooterComponent={
                ListFooterComponent
            }
            drawDistance={drawDistance}
            refreshControl={
                onRefresh ? (
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                    />
                ) : undefined
            }
        />
    );
}

export const DynamicFlashList =
    memo(
        FlashListComponent,
    ) as typeof FlashListComponent;