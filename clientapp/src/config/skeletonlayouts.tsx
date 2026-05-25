import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Skeleton from '../components/skeleton';

const { width } = Dimensions.get('window');

export const ProductListSkeleton = () => {
  return (
    <View style={styles.container}>
      {[1, 2, 3, 4].map((item) => (
        <View key={item} style={styles.productCard}>
          <Skeleton width={150} height={120} borderRadius={15} />
          <View style={styles.productInfo}>
            <Skeleton width={100} height={15} style={{ marginTop: 10 }} />
            <Skeleton width={60} height={12} style={{ marginTop: 5 }} />
            <View style={styles.priceRow}>
              <Skeleton width={40} height={18} />
              <Skeleton width={30} height={30} borderRadius={15} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

export const ProfileSkeleton = () => {
  return (
    <View style={styles.profileContainer}>
      <Skeleton width={100} height={100} borderRadius={50} />
      <Skeleton width={150} height={20} style={{ marginTop: 20 }} />
      <Skeleton width={200} height={15} style={{ marginTop: 10 }} />
      
      <View style={styles.statsRow}>
        <Skeleton width={80} height={40} borderRadius={10} />
        <Skeleton width={80} height={40} borderRadius={10} />
        <Skeleton width={80} height={40} borderRadius={10} />
      </View>

      <View style={styles.menuContainer}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.menuItem}>
            <Skeleton width={30} height={30} borderRadius={15} />
            <Skeleton width={180} height={15} style={{ marginLeft: 15 }} />
          </View>
        ))}
      </View>
    </View>
  );
};

export const AboutScreenSkeleton = () => {
  return (
    <View style={styles.contentPadding}>
      <Skeleton width="100%" height={200} borderRadius={15} />
      <Skeleton width="60%" height={25} style={{ marginTop: 30 }} />
      <Skeleton width="100%" height={15} style={{ marginTop: 20 }} />
      <Skeleton width="100%" height={15} style={{ marginTop: 10 }} />
      <Skeleton width="100%" height={15} style={{ marginTop: 10 }} />
      <Skeleton width="80%" height={15} style={{ marginTop: 10 }} />
      
      <Skeleton width="40%" height={20} style={{ marginTop: 40 }} />
      <View style={styles.statsRow}>
        <Skeleton width={60} height={60} borderRadius={30} />
        <Skeleton width={60} height={60} borderRadius={30} />
        <Skeleton width={60} height={60} borderRadius={30} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 15,
  },
  contentPadding: {
    padding: 20,
  },
  productCard: {
    width: (width - 45) / 2,
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  productInfo: {
    marginTop: 5,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
  },
  profileContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 30,
    paddingHorizontal: 20,
  },
  menuContainer: {
    width: '100%',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
});
