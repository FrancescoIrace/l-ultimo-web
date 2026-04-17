function normalizeProfileData(data) {
    return {
        username: data?.username ?? '',
        province: data?.province ?? '',
        zip_code: data?.zip_code ?? '',
        gender: data?.gender ?? 'Other',
        avatar_url: data?.avatar_url ?? ''
    };
}

export { normalizeProfileData };