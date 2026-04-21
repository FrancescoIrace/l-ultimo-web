function normalizeProfileData(data) {
    return {
        username: data?.username ?? '',
        full_name: data?.full_name ?? '',
        city: data?.city ?? '',
        province: data?.province ?? '',
        zip_code: data?.zip_code ?? '',
        gender: data?.gender ?? 'Other',
        avatar_url: data?.avatar_url ?? '',
        location: data?.location ?? '',
        location_lat: data?.location_lat ?? null,
        location_lng: data?.location_lng ?? null,
        favorite_sport: data?.favorite_sport ?? '',
    };
}

export { normalizeProfileData };