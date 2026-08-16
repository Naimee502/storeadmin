#import <React/RCTBridgeModule.h>

// Objective-C bridge for ScreenGuard.swift. Swift classes annotated with
// @objc are still invisible to React Native's module registry until they are
// declared here — this file is what makes NativeModules.ScreenGuard exist.
//
// The method signatures must match the Swift @objc selectors exactly, hence
// setSecure:resolver:rejecter:.
@interface RCT_EXTERN_MODULE (ScreenGuard, NSObject)

RCT_EXTERN_METHOD(setSecure:(BOOL)value
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isFullyEnforced)

@end
