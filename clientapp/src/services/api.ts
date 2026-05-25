import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_CONFIG, ENDPOINTS } from '../config';

export const baseApi = createApi({
  reducerPath: 'baseApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_CONFIG.BASE_URL,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as any).auth?.token; 
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      return headers;
    },
  }),
  tagTypes: ['User', 'Profile'], 
  endpoints: (builder) => ({
    login: builder.mutation<any, Record<string, string>>({
      query: (credentials) => ({
        url: ENDPOINTS.AUTH.LOGIN,
        method: 'POST',
        body: credentials,
      }),
    }),

    updateProfileWithImage: builder.mutation<any, FormData>({
      query: (formData) => ({
        url: ENDPOINTS.USER.UPDATE_AVATAR,
        method: 'POST',
        body: formData, 
      }),
      invalidatesTags: ['Profile'],
    }),

    getProfile: builder.query<any, void>({
      query: () => ENDPOINTS.USER.PROFILE,
      providesTags: ['Profile'],
    }),
  }),
});

export const {
  useLoginMutation,
  useUpdateProfileWithImageMutation,
  useGetProfileQuery,
} = baseApi;
