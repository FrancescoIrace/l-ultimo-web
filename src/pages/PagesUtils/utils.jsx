function normalizeProfileData(data) {
    return {
        username: data?.username ?? '',
        full_name: data?.full_name ?? '',
        province: data?.province ?? '',
        zip_code: data?.zip_code ?? '',
        gender: data?.gender ?? 'Other',
        avatar_url: data?.avatar_url ?? ''
    };
}

export { normalizeProfileData };