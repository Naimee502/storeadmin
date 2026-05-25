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

    estimatedItemSize = 200,

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

    removeClippedSubviews = true,

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
            estimatedItemSize={
                estimatedItemSize
            }
            numColumns={numColumns}
            horizontal={horizontal}
            scrollEnabled={scrollEnabled}
            extraData={extraData}
            removeClippedSubviews={
                removeClippedSubviews
            }
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